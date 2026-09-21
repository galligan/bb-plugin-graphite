import { readStack, StackReadError, stackChain, stackOffshoots } from "./stack/index.ts";
import type { StackSnapshot } from "./stack/types.ts";
import type { HostStackResult } from "./host-contract.ts";

/** Assemble the host-local portion before joining BB threads on the server. */
export function summarizeStack(snapshot: StackSnapshot, branchName: string): HostStackResult {
  const chain = stackChain(snapshot, branchName);
  if (chain === null) return { outcome: "none", reason: "branch is not tracked by Graphite" };

  const inChain = new Set(chain.branches.map((branch) => branch.name));
  const warnings: string[] = [];
  if (snapshot.schema.unexpected.length > 0 || snapshot.schema.missing.length > 0) {
    const migrations = (names: readonly string[]) =>
      names.slice(0, 5).map((name) => name.slice(0, 120)).join(", ") +
      (names.length > 5 ? `, and ${names.length - 5} more` : "");
    warnings.push(
      "Graphite metadata schema changed: " +
      `unexpected [${migrations(snapshot.schema.unexpected)}], ` +
      `missing [${migrations(snapshot.schema.missing)}]`,
    );
  }

  return {
    outcome: "stacked",
    branch: branchName,
    position: chain.position,
    total: chain.total,
    placement: chain.placement,
    needsRestack: chain.needsRestack,
    isStale: chain.isStale,
    warnings,
    branches: chain.branches.map((branch) => ({
      name: branch.name,
      isCurrent: branch.name === branchName,
      needsRestack: branch.needsRestack,
      isStale: branch.isStale,
      offshoots: stackOffshoots(snapshot, inChain, branch.name),
    })),
  };
}

export async function readHostStack(repoPath: string, branchName: string): Promise<HostStackResult> {
  try {
    return summarizeStack(await readStack({ repoPath }), branchName);
  } catch (cause) {
    if (cause instanceof StackReadError) {
      return { outcome: "none", reason: cause.code.replaceAll("_", " ") };
    }
    throw cause;
  }
}
