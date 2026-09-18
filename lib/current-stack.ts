// Resolves the stack chain for a project's environment, joining Graphite's
// metadata with BB's view of the workspace.
//
// This is the only place the two sides meet. `lib/stack/` stays free of the SDK.

import type { BbPluginApi } from "@get-bb/plugin-sdk";

import { readStack, StackReadError, stackChain, stackOffshoots } from "./stack/index.ts";

export interface CurrentStackRequest {
  readonly projectId: string;
  /** Prefer this thread's environment; falls back to the project's first. */
  readonly threadId?: string | null;
}

// Wire shapes. Plain data, so they match the RPC contract's inferred types
// without a cast; the readonly discipline lives in lib/stack/.
export interface CurrentStackOffshoot {
  name: string;
  /** Divergence column, 1 for the first line off the branch. Not generation depth. */
  column: number;
  needsRestack: boolean;
  isStale: boolean;
}

export interface CurrentStackBranch {
  name: string;
  isCurrent: boolean;
  needsRestack: boolean;
  isStale: boolean;
  /** Branches growing out of this one that the chain does not run through. */
  offshoots: CurrentStackOffshoot[];
}

export type CurrentStack =
  | {
      outcome: "stacked";
      branch: string;
      position: number;
      total: number;
      placement: "top" | "middle" | "bottom";
      needsRestack: boolean;
      isStale: boolean;
      workingTree: string | null;
      branches: CurrentStackBranch[];
    }
  /** No stack to show: not a Graphite repo, branch untracked, or no environment. */
  | { outcome: "none"; reason: string };

function none(reason: string): CurrentStack {
  return { outcome: "none", reason };
}

export async function currentStack(
  bb: BbPluginApi,
  request: CurrentStackRequest,
): Promise<CurrentStack> {
  const environments = await bb.sdk.environments.list({ projectId: request.projectId });
  if (environments.length === 0) return none("no environment for this project");

  let chosen = environments[0];
  if (request.threadId != null) {
    const thread = await bb.sdk.threads.get({ threadId: request.threadId });
    const match = environments.find((candidate) => candidate.id === thread.environmentId);
    if (match !== undefined) chosen = match;
  }

  const path = chosen.path;
  if (path === null) return none("environment has no workspace path");
  if (!chosen.isGitRepo) return none("workspace is not a git repository");

  // The branch and working-tree state come from BB, never from a git call here.
  const status = await bb.sdk.environments.status({ environmentId: chosen.id });
  if (status.outcome !== "available") return none(`environment ${status.outcome}`);
  const checkout = status.workspace.checkout;
  if (checkout.kind !== "branch") return none(`checkout is ${checkout.kind}`);

  let snapshot;
  try {
    snapshot = await readStack({ repoPath: path });
  } catch (cause) {
    if (cause instanceof StackReadError) return none(cause.code.replaceAll("_", " "));
    throw cause;
  }

  const chain = stackChain(snapshot, checkout.branchName);
  if (chain === null) return none("branch is not tracked by Graphite");

  const inChain = new Set(chain.branches.map((branch) => branch.name));

  return {
    outcome: "stacked",
    branch: checkout.branchName,
    position: chain.position,
    total: chain.total,
    placement: chain.placement,
    needsRestack: chain.needsRestack,
    isStale: chain.isStale,
    workingTree: status.workspace.workingTree.state,
    branches: chain.branches.map((branch) => ({
      name: branch.name,
      isCurrent: branch.name === checkout.branchName,
      needsRestack: branch.needsRestack,
      isStale: branch.isStale,
      offshoots: stackOffshoots(snapshot, inChain, branch.name),
    })),
  };
}
