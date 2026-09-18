// The write path: `gt` verbs with the guard in front of them.
//
// Every verb refuses on a working tree that is not clean. That is the hazard
// `bb-plugin-dev` names — a restack or a sync over uncommitted work is not
// recoverable from inside BB — and the check comes from `environments.status`,
// never from a git call of our own.

import type { BbPluginApi } from "@get-bb/plugin-sdk";

import { resolveEnvironment, type CurrentStackRequest } from "./current-stack.ts";
import { runGt } from "./gt.ts";

export type VerbName = "restack" | "submit" | "sync" | "merge";

export interface VerbRequest extends CurrentStackRequest {
  readonly verb: VerbName;
  /** Extra `gt` arguments the caller parsed, already validated. */
  readonly args?: readonly string[];
  /** Proceed on a dirty tree. The caller must have asked for this explicitly. */
  readonly force?: boolean;
  readonly signal?: AbortSignal;
}

export type VerbOutcome =
  | { readonly outcome: "ran"; readonly exitCode: number; readonly stdout: string; readonly stderr: string }
  | { readonly outcome: "refused"; readonly reason: string }
  | { readonly outcome: "unavailable"; readonly reason: string };

/** `gt` verbs that ask before acting. `-f` is the only non-interactive answer. */
const FORCE_FLAG: Readonly<Record<VerbName, boolean>> = {
  restack: false,
  submit: false,
  sync: true,
  merge: false,
};

export async function runVerb(bb: BbPluginApi, request: VerbRequest): Promise<VerbOutcome> {
  const resolution = await resolveEnvironment(bb, request);
  if (resolution.outcome !== "resolved") {
    return { outcome: "unavailable", reason: resolution.reason };
  }
  const environment = resolution.environment;

  if (environment.workingTree !== "clean" && request.force !== true) {
    return {
      outcome: "refused",
      reason:
        `working tree is ${environment.workingTree}; ` +
        `commit or stash first, or pass --force to proceed anyway`,
    };
  }

  const args = [request.verb, ...(request.args ?? [])];
  if (FORCE_FLAG[request.verb]) args.push("-f");

  const result = await runGt(args, { cwd: environment.path, signal: request.signal });
  if (result.outcome === "not_found") {
    return {
      outcome: "unavailable",
      reason: `the gt binary was not found; looked in ${result.tried.join(", ")}`,
    };
  }
  if (result.outcome === "failed") {
    return { outcome: "unavailable", reason: `gt could not be run: ${result.message}` };
  }
  return {
    outcome: "ran",
    exitCode: result.exitCode,
    stdout: result.stdout,
    stderr: result.stderr,
  };
}
