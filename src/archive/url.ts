// A repository URL is owner/repo on github.com. A branch, a file, or another
// host is rejected here rather than guessed into a repository.

const REPOSITORY_URL =
  /^(?:https?:\/\/)?(?:www\.)?github\.com\/([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+?)(?:\.git)?\/?(?:[?#].*)?$/;

export type RepositoryName = {
  owner: string;
  repo: string;
  key: string;
  url: string;
};

export function parseRepositoryUrl(input: string): RepositoryName | null {
  const match = REPOSITORY_URL.exec(input.trim());
  if (!match) return null;
  const owner = match[1];
  const repo = match[2];
  if (!owner || !repo || owner === "." || owner === ".." || repo === "." || repo === "..") {
    return null;
  }
  return {
    owner,
    repo,
    key: `${owner}/${repo}`.toLowerCase(),
    url: `https://github.com/${owner}/${repo}`,
  };
}
