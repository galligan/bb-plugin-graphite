// The single line through a stack that contains one branch.
//
// A repository can hold many unrelated stacks — 158 branches across 40 roots in
// ~/Developer/outfitter/skillset. A surface that shows all of them shows nothing.
// This reduces a snapshot to the one chain the caller is standing in.
//
// Pure: a snapshot in, a chain out.

import type { StackBranch, StackSnapshot } from "./types.ts";

export interface StackChain {
  /** Root first, deepest descendant last. Always contains `branch`. */
  readonly branches: readonly StackBranch[];
  /** 1-based index of the requested branch within `branches`. */
  readonly position: number;
  readonly total: number;
  /** Where the requested branch sits, for the position icon. */
  readonly placement: "top" | "middle" | "bottom";
  /**
   * A branch at or below the requested one is stacked on a stale parent. Below
   * matters: restacking it moves everything above, including the requested branch.
   */
  readonly needsRestack: boolean;
  /** Graphite's recorded head disagrees with git for some branch in the chain. */
  readonly isStale: boolean;
}

function placementOf(position: number, total: number): StackChain["placement"] {
  if (total <= 1 || position === 1) return "bottom";
  if (position === total) return "top";
  return "middle";
}

/**
 * Walks up through parents and down through children. Descends the single child
 * when a branch has exactly one; a fork ends the chain, because past a fork there
 * is no longer one line to show.
 */
export function stackChain(
  snapshot: StackSnapshot,
  branchName: string,
): StackChain | null {
  const byName = new Map(snapshot.branches.map((branch) => [branch.name, branch]));
  const start = byName.get(branchName);
  if (start === undefined) return null;

  const inCycle = new Set(snapshot.cycles.flat());

  const ancestors: StackBranch[] = [];
  const seenUp = new Set<string>([branchName]);
  let up = start.parent === null ? undefined : byName.get(start.parent);
  while (up !== undefined && !seenUp.has(up.name) && !inCycle.has(up.name)) {
    ancestors.unshift(up);
    seenUp.add(up.name);
    up = up.parent === null ? undefined : byName.get(up.parent);
  }

  const descendants: StackBranch[] = [];
  const seenDown = new Set<string>([branchName]);
  let down = start.children.length === 1 ? byName.get(start.children[0]) : undefined;
  while (down !== undefined && !seenDown.has(down.name) && !inCycle.has(down.name)) {
    descendants.push(down);
    seenDown.add(down.name);
    down = down.children.length === 1 ? byName.get(down.children[0]) : undefined;
  }

  const branches = [...ancestors, start, ...descendants];
  const position = ancestors.length + 1;
  // branches is root-first, so everything at or below the branch is the prefix.
  const atOrBelow = branches.slice(0, position);

  return {
    branches,
    position,
    total: branches.length,
    placement: placementOf(position, branches.length),
    needsRestack: atOrBelow.some((branch) => branch.needsRestack),
    isStale: branches.some((branch) => branch.isStale),
  };
}
