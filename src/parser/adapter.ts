// Framework knowledge plugs in here. The parser calls this and does not branch
// on a framework. This phase only has the fallback, which contributes nothing.

export type Adapter = {
  readonly name: string;
  excludedDirectories(): readonly string[];
};

export const noFramework: Adapter = {
  name: "none",
  excludedDirectories() {
    return [];
  },
};
