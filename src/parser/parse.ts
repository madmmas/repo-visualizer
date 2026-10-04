import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { Node, Project, SyntaxKind, type SourceFile, ts } from "ts-morph";
import { noFramework, type Adapter } from "./adapter.ts";
import { dedupeEdges, withFan, type FileFacts } from "./graph.ts";
import { assertResult } from "./result.ts";
import {
  folderOf,
  type Edge,
  type ExcludedDirectory,
  type ImportKind,
  type ImportSighting,
  type ImportStatus,
  type ParseResult,
  type SkippedFile,
} from "./types.ts";
import { walk } from "./walk.ts";

type ResolvedTarget = {
  status: ImportStatus;
  to?: string;
  reason?: string;
};

// Keep every import that was seen. An edge exists only when resolution landed
// on a file that became a node. require() is not read in this phase.
export function parseRepository(
  directory: string,
  adapter: Adapter = noFramework,
): ParseResult {
  const resolved = path.resolve(directory);
  if (!fs.existsSync(resolved)) {
    throw new Error(`Directory not found: ${resolved}`);
  }
  const root = fs.realpathSync(resolved);
  if (!fs.statSync(root).isDirectory()) {
    throw new Error(`Not a directory: ${root}`);
  }

  const exclusions = adapter.excludedDirectories().map(normalizeExclusion);
  const walked = walk(root, exclusions);
  const options = loadCompilerOptions(root);
  const project = new Project({
    compilerOptions: options,
    skipFileDependencyResolution: true,
    skipLoadingLibFiles: true,
  });

  const facts: FileFacts[] = [];
  const skipped: SkippedFile[] = [...walked.skipped];
  const skippedByPath = new Map(skipped.map((file) => [file.path, file.reason]));

  for (const file of walked.source) {
    let buffer: Buffer;
    try {
      buffer = fs.readFileSync(file.absolute);
    } catch (error) {
      const reason = `unreadable: ${messageOf(error)}`;
      skipped.push({ path: file.path, reason });
      skippedByPath.set(file.path, reason);
      continue;
    }
    if (buffer.includes(0)) {
      const reason = "binary file";
      skipped.push({ path: file.path, reason });
      skippedByPath.set(file.path, reason);
      continue;
    }
    const text = buffer.toString("utf8");
    try {
      project.createSourceFile(file.absolute, text, { overwrite: true });
    } catch (error) {
      const reason = `could not parse: ${messageOf(error)}`;
      skipped.push({ path: file.path, reason });
      skippedByPath.set(file.path, reason);
      continue;
    }
    facts.push({
      path: file.path,
      folder: folderOf(file.path),
      lines: countLines(text),
      hash: createHash("sha256").update(buffer).digest("hex"),
    });
  }

  const parsed = new Set(facts.map((file) => file.path));
  const host = project.getModuleResolutionHost();
  const cache = ts.createModuleResolutionCache(
    root,
    (value) => value,
    options,
  );
  const sightings: ImportSighting[] = [];
  const resolvedEdges: Edge[] = [];

  for (const sourceFile of project.getSourceFiles()) {
    const from = relativeInside(root, sourceFile.getFilePath());
    if (!parsed.has(from)) continue;
    collectImports(sourceFile, (kind, specifier) => {
      const target = classify(
        root,
        sourceFile.getFilePath(),
        specifier,
        options,
        host,
        cache,
        parsed,
        skippedByPath,
        walked.excludedDirectories,
      );
      sightings.push({
        from,
        kind,
        specifier,
        status: target.status,
        ...(target.to ? { to: target.to } : {}),
        ...(target.reason ? { reason: target.reason } : {}),
      });
      if (target.status === "resolved" && target.to) {
        resolvedEdges.push({ from, to: target.to, kind, specifier });
      }
    });
    collectNonLiteralDynamicImports(sourceFile, from, sightings);
  }

  sightings.sort((a, b) =>
    compare(
      `${a.from}\0${a.kind}\0${a.specifier}\0${a.status}`,
      `${b.from}\0${b.kind}\0${b.specifier}\0${b.status}`,
    ),
  );
  const edges = dedupeEdges(
    resolvedEdges.sort((a, b) =>
      compare(
        `${a.from}\0${a.to}\0${a.kind}\0${a.specifier}`,
        `${b.from}\0${b.to}\0${b.kind}\0${b.specifier}`,
      ),
    ),
  );
  skipped.sort((a, b) => compare(a.path, b.path));

  const result: ParseResult = {
    root,
    adapter: adapter.name,
    counts: {
      found: facts.length + skipped.length,
      parsed: facts.length,
      skipped: skipped.length,
    },
    files: withFan(facts, edges).sort((a, b) => compare(a.path, b.path)),
    edges,
    skipped,
    excludedDirectories: walked.excludedDirectories,
    imports: sightings,
  };
  assertResult(result);
  return result;
}

function collectImports(
  sourceFile: SourceFile,
  visit: (kind: ImportKind, specifier: string) => void,
): void {
  for (const declaration of sourceFile.getImportDeclarations()) {
    visit("import", declaration.getModuleSpecifierValue());
  }
  for (const declaration of sourceFile.getExportDeclarations()) {
    const specifier = declaration.getModuleSpecifierValue();
    if (specifier === undefined) continue;
    visit("reexport", specifier);
  }
  for (const call of sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression)) {
    if (call.getExpression().getKind() !== SyntaxKind.ImportKeyword) continue;
    const argument = call.getArguments()[0];
    if (!argument) continue;
    const specifier = literalSpecifier(argument);
    if (specifier === undefined) continue;
    visit("dynamic", specifier);
  }
}

function collectNonLiteralDynamicImports(
  sourceFile: SourceFile,
  from: string,
  sightings: ImportSighting[],
): void {
  for (const call of sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression)) {
    if (call.getExpression().getKind() !== SyntaxKind.ImportKeyword) continue;
    const argument = call.getArguments()[0];
    if (!argument) {
      sightings.push({
        from,
        kind: "dynamic",
        specifier: "",
        status: "unresolved",
        reason: "dynamic import has no specifier",
      });
      continue;
    }
    if (literalSpecifier(argument) !== undefined) continue;
    sightings.push({
      from,
      kind: "dynamic",
      specifier: argument.getText(),
      status: "unresolved",
      reason: "dynamic import specifier is not a string literal",
    });
  }
}

function literalSpecifier(node: Node): string | undefined {
  if (Node.isStringLiteral(node)) return node.getLiteralValue();
  if (Node.isNoSubstitutionTemplateLiteral(node)) return node.getLiteralValue();
  return undefined;
}

function classify(
  root: string,
  fromAbsolute: string,
  specifier: string,
  options: ts.CompilerOptions,
  host: ts.ModuleResolutionHost,
  cache: ts.ModuleResolutionCache,
  parsed: ReadonlySet<string>,
  skipped: ReadonlyMap<string, string>,
  excludedDirectories: readonly ExcludedDirectory[],
): ResolvedTarget {
  const resolution = ts.resolveModuleName(specifier, fromAbsolute, options, host, cache);
  const resolvedFile = resolution.resolvedModule?.resolvedFileName;
  if (resolvedFile) {
    return classifyResolvedPath(
      root,
      specifier,
      path.resolve(resolvedFile),
      resolution.resolvedModule?.isExternalLibraryImport === true,
      parsed,
      skipped,
      excludedDirectories,
    );
  }

  if (isFilesystemSpecifier(specifier)) {
    const exact = exactFile(fromAbsolute, specifier);
    if (exact) {
      return classifyResolvedPath(root, specifier, exact, false, parsed, skipped, excludedDirectories);
    }
    return { status: "unresolved", reason: "module not found" };
  }

  if (matchesPathAlias(specifier, options.paths)) {
    return { status: "unresolved", reason: "path alias did not resolve to a file" };
  }

  return { status: "external", reason: "points outside the repository" };
}

function classifyResolvedPath(
  root: string,
  specifier: string,
  absolute: string,
  externalLibrary: boolean,
  parsed: ReadonlySet<string>,
  skipped: ReadonlyMap<string, string>,
  excludedDirectories: readonly ExcludedDirectory[],
): ResolvedTarget {
  let real = absolute;
  try {
    real = fs.realpathSync(absolute);
  } catch {
    real = absolute;
  }
  if (!isInside(root, real)) {
    return { status: "external", reason: "resolved outside the repository" };
  }
  const relative = path.relative(root, real).split(path.sep).join("/");
  if (parsed.has(relative)) {
    return { status: "resolved", to: relative };
  }
  if (isFilesystemSpecifier(specifier)) {
    return excludedTarget(relative, skipped, excludedDirectories);
  }
  if (externalLibrary || underExcluded(relative, excludedDirectories, "dependency directory")) {
    return { status: "external", reason: "points outside the repository" };
  }
  return excludedTarget(relative, skipped, excludedDirectories);
}

function excludedTarget(
  relative: string,
  skipped: ReadonlyMap<string, string>,
  excludedDirectories: readonly ExcludedDirectory[],
): ResolvedTarget {
  const skipReason = skipped.get(relative);
  if (skipReason) return { status: "excluded", reason: skipReason };
  const directory = excludedDirectories.find(
    (entry) => relative === entry.path || relative.startsWith(`${entry.path}/`),
  );
  if (directory) return { status: "excluded", reason: directory.reason };
  return {
    status: "unresolved",
    reason: "resolved path was not part of the walk",
  };
}

function underExcluded(
  relative: string,
  excludedDirectories: readonly ExcludedDirectory[],
  reason: string,
): boolean {
  return excludedDirectories.some(
    (entry) =>
      entry.reason === reason &&
      (relative === entry.path || relative.startsWith(`${entry.path}/`)),
  );
}

function exactFile(fromAbsolute: string, specifier: string): string | undefined {
  const candidate = path.resolve(path.dirname(fromAbsolute), specifier);
  try {
    if (fs.statSync(candidate).isFile()) return candidate;
  } catch {
    return undefined;
  }
  return undefined;
}

function isFilesystemSpecifier(specifier: string): boolean {
  return (
    specifier.startsWith("./") ||
    specifier.startsWith("../") ||
    path.isAbsolute(specifier)
  );
}

function isInside(root: string, candidate: string): boolean {
  const relative = path.relative(root, candidate);
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

// A lone "*" would swallow every package name, so only a real alias pattern
// counts. The compiler already tried the pattern; this only names the failure.
function matchesPathAlias(
  specifier: string,
  paths: ts.CompilerOptions["paths"],
): boolean {
  if (!paths) return false;
  for (const pattern of Object.keys(paths)) {
    if (pattern === "*") continue;
    if (patternMatches(pattern, specifier)) return true;
  }
  return false;
}

function patternMatches(pattern: string, specifier: string): boolean {
  const star = pattern.indexOf("*");
  if (star === -1) return pattern === specifier;
  const prefix = pattern.slice(0, star);
  const suffix = pattern.slice(star + 1);
  if (!specifier.startsWith(prefix) || !specifier.endsWith(suffix)) return false;
  return specifier.length >= prefix.length + suffix.length;
}

function loadCompilerOptions(root: string): ts.CompilerOptions {
  const configPath = path.join(root, "tsconfig.json");
  const options = fs.existsSync(configPath)
    ? readTsConfig(configPath, root)
    : defaultCompilerOptions();
  // File selection already kept JavaScript. The compiler has to be willing to
  // read it, whatever the tsconfig said. JSX is left alone when the repo set it.
  options.allowJs = true;
  options.noEmit = true;
  if (options.jsx === undefined) options.jsx = ts.JsxEmit.Preserve;
  delete options.plugins;
  return options;
}

function readTsConfig(configPath: string, root: string): ts.CompilerOptions {
  const read = ts.readConfigFile(configPath, ts.sys.readFile);
  if (read.error) {
    throw new Error(diagnosticText(read.error));
  }
  const parsed = ts.parseJsonConfigFileContent(read.config, ts.sys, root);
  if (parsed.errors.length > 0) {
    throw new Error(parsed.errors.map(diagnosticText).join("\n"));
  }
  return { ...parsed.options };
}

function defaultCompilerOptions(): ts.CompilerOptions {
  // No tsconfig: extensionless imports follow the compiler's bundler search
  // (real extensions, then index). A miss stays unresolved.
  return {
    allowJs: true,
    checkJs: false,
    noEmit: true,
    strict: true,
    target: ts.ScriptTarget.ESNext,
    module: ts.ModuleKind.ESNext,
    moduleResolution: ts.ModuleResolutionKind.Bundler,
    jsx: ts.JsxEmit.Preserve,
    esModuleInterop: true,
    resolveJsonModule: true,
    skipLibCheck: true,
  };
}

function diagnosticText(diagnostic: ts.Diagnostic): string {
  return ts.flattenDiagnosticMessageText(diagnostic.messageText, "\n");
}

function normalizeExclusion(value: string): string {
  const relative = value.replaceAll("\\", "/").replace(/^\/+|\/+$/g, "");
  if (!relative || relative.split("/").includes("..")) {
    throw new Error(`Adapter exclusion is not a relative directory: ${value}`);
  }
  return relative;
}

function countLines(text: string): number {
  if (text.length === 0) return 0;
  let lines = 1;
  for (let index = 0; index < text.length; index++) {
    if (text.charCodeAt(index) === 10) lines++;
  }
  if (text.charCodeAt(text.length - 1) === 10) lines--;
  return lines;
}

function relativeInside(root: string, absolute: string): string {
  const real = fs.existsSync(absolute) ? fs.realpathSync(absolute) : path.resolve(absolute);
  const relative = path.relative(root, real);
  return relative.split(path.sep).join("/");
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function compare(a: string, b: string): number {
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
}
