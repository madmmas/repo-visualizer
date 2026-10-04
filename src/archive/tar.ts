import { createReadStream } from "node:fs";
import fs from "node:fs";
import path from "node:path";
import { createGunzip } from "node:zlib";

// GitHub's codeload archives are gzip-compressed ustar. Long names arrive as a
// GNU long-name header or a pax header. Paths that climb out of the destination
// are rejected.

export async function extractTarGz(
  archivePath: string,
  destination: string,
  signal?: AbortSignal,
): Promise<void> {
  throwIfStopped(signal);
  fs.mkdirSync(destination, { recursive: true });
  const source = createReadStream(archivePath).pipe(createGunzip());
  const onAbort = () => source.destroy(new Error("Stopped."));
  signal?.addEventListener("abort", onAbort, { once: true });
  try {
    const reader = new ByteReader(source);
    await readArchive(reader, destination, signal);
  } finally {
    signal?.removeEventListener("abort", onAbort);
  }
}

function throwIfStopped(signal?: AbortSignal): void {
  if (signal?.aborted) throw new Error("Stopped.");
}

async function readArchive(reader: ByteReader, destination: string, signal?: AbortSignal): Promise<void> {
  let longName: string | undefined;
  let paxName: string | undefined;
  for (;;) {
    throwIfStopped(signal);
    const header = await reader.read(512);
    if (!header || header.length < 512) {
      if (header && header.some((byte) => byte !== 0)) {
        throw new Error("The archive ended inside a header.");
      }
      return;
    }
    if (header.every((byte) => byte === 0)) {
      const next = await reader.read(512);
      if (next && next.some((byte) => byte !== 0)) {
        throw new Error("The archive is corrupt.");
      }
      return;
    }
    if (!checksumMatches(header)) throw new Error("The archive is corrupt.");

    const size = readOctal(header, 124, 12);
    const type = header[156] ?? 0;
    const rawName = headerName(header);
    const name = longName ?? paxName ?? rawName;
    longName = undefined;
    paxName = undefined;

    if (type === 76) {
      longName = (await readBody(reader, size)).toString("utf8").replace(/\0+$/, "");
      continue;
    }
    if (type === 120) {
      const text = (await readBody(reader, size)).toString("utf8");
      paxName = paxPath(text) ?? name;
      continue;
    }
    if (type === 103) {
      await readBody(reader, size);
      continue;
    }
    if (type === 53) {
      await readBody(reader, size);
      fs.mkdirSync(safePath(destination, name), { recursive: true });
      continue;
    }
    if (type === 0 || type === 48) {
      const filePath = safePath(destination, name);
      fs.mkdirSync(path.dirname(filePath), { recursive: true });
      await writeBody(reader, size, filePath);
      continue;
    }
    await readBody(reader, size);
  }
}

function headerName(header: Buffer): string {
  const name = readString(header, 0, 100);
  const prefix = readString(header, 345, 155);
  if (!prefix) return name;
  return `${prefix}/${name}`;
}

function readString(header: Buffer, start: number, length: number): string {
  return header.subarray(start, start + length).toString("utf8").replace(/\0.*$/, "");
}

function readOctal(header: Buffer, start: number, length: number): number {
  const first = header[start] ?? 0;
  if ((first & 0x80) !== 0) throw new Error("The archive entry is too large to extract.");
  const text = header.subarray(start, start + length).toString("utf8").replace(/\0/g, "").trim();
  if (!text) return 0;
  if (!/^[0-7]+$/.test(text)) throw new Error("The archive is corrupt.");
  const value = Number.parseInt(text, 8);
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new Error("The archive entry is too large to extract.");
  }
  return value;
}

function checksumMatches(header: Buffer): boolean {
  const stored = readOctal(header, 148, 8);
  let sum = 0;
  for (let index = 0; index < 512; index++) {
    const byte = header[index] ?? 0;
    sum += index >= 148 && index < 156 ? 32 : byte;
  }
  return sum === stored;
}

function paxPath(text: string): string | undefined {
  for (const line of text.split("\n")) {
    const separator = line.indexOf(" ");
    if (separator === -1) continue;
    const record = line.slice(separator + 1);
    if (record.startsWith("path=")) return record.slice("path=".length);
  }
  return undefined;
}

function safePath(destination: string, name: string): string {
  const normalized = path.posix.normalize(name).replace(/^\.\/+/, "");
  if (
    !normalized ||
    normalized === "." ||
    normalized.startsWith("/") ||
    normalized.split("/").includes("..")
  ) {
    throw new Error(`The archive path escapes the destination: ${name}`);
  }
  const full = path.resolve(destination, ...normalized.split("/"));
  const relative = path.relative(destination, full);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error(`The archive path escapes the destination: ${name}`);
  }
  return full;
}

async function readBody(reader: ByteReader, size: number): Promise<Buffer> {
  const padded = size === 0 ? 0 : Math.ceil(size / 512) * 512;
  if (padded === 0) return Buffer.alloc(0);
  const body = await reader.read(padded);
  if (!body || body.length < padded) throw new Error("The archive ended inside a file.");
  return body.subarray(0, size);
}

async function writeBody(reader: ByteReader, size: number, filePath: string): Promise<void> {
  const padded = size === 0 ? 0 : Math.ceil(size / 512) * 512;
  const handle = fs.openSync(filePath, "w");
  try {
    let remaining = size;
    let pending = padded;
    while (pending > 0) {
      const chunk = Math.min(pending, 1024 * 512);
      const block = await reader.read(chunk);
      if (!block || block.length < chunk) throw new Error("The archive ended inside a file.");
      const write = Math.min(remaining, block.length);
      if (write > 0) fs.writeSync(handle, block, 0, write);
      remaining -= write;
      pending -= block.length;
    }
  } finally {
    fs.closeSync(handle);
  }
}

class ByteReader {
  private pending: Uint8Array = Buffer.alloc(0);
  private queue: Uint8Array[] = [];
  private done = false;
  private failed: Error | undefined;
  private waiting: (() => void) | undefined;

  constructor(source: AsyncIterable<Buffer>) {
    void this.pump(source);
  }

  async read(bytes: number): Promise<Buffer | null> {
    while (this.pending.length < bytes && !(this.done && this.queue.length === 0)) {
      const next = this.queue.shift();
      if (next) {
        this.pending = this.pending.length === 0 ? next : Buffer.concat([this.pending, next]);
        continue;
      }
      await new Promise<void>((resolve) => {
        this.waiting = resolve;
        if (this.queue.length > 0 || this.done) {
          this.waiting = undefined;
          resolve();
        }
      });
    }
    if (this.failed && this.pending.length < bytes) throw this.failed;
    if (this.pending.length === 0) return null;
    const take = Math.min(bytes, this.pending.length);
    const out = this.pending.subarray(0, take);
    this.pending = this.pending.subarray(take);
    return Buffer.from(out);
  }

  private async pump(source: AsyncIterable<Buffer>): Promise<void> {
    try {
      for await (const chunk of source) {
        this.queue.push(chunk);
        this.wake();
      }
    } catch (error) {
      this.failed = error instanceof Error ? error : new Error(String(error));
    } finally {
      this.done = true;
      this.wake();
    }
  }

  private wake(): void {
    const resolve = this.waiting;
    this.waiting = undefined;
    resolve?.();
  }
}
