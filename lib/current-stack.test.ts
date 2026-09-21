import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { BbPluginApi } from "@get-bb/plugin-sdk";

import { resolveEnvironment } from "./current-stack.ts";
import { runVerb } from "./verbs.ts";

function bbWithEnvironments(
  environments: Array<{ id: string; isWorktree?: boolean }>,
  threadEnvironmentId: string | null,
): BbPluginApi {
  const bb = {
    sdk: {
      environments: {
        list: async () => environments.map((environment) => ({
          id: environment.id,
          path: "/tmp/graphite-test",
          hostId: "host-1",
          isWorktree: environment.isWorktree ?? false,
          isGitRepo: true,
        })),
        status: async () => {
          return {
            outcome: "available",
            workspace: {
              checkout: { kind: "branch", branchName: "feature" },
              workingTree: { state: "clean" },
            },
          };
        },
      },
      threads: {
        get: async () => {
          if (threadEnvironmentId === null) throw new Error("not found");
          return { environmentId: threadEnvironmentId };
        },
      },
    },
  };
  // The test supplies only the SDK methods exercised by resolution.
  return bb as unknown as BbPluginApi;
}

describe("environment targeting", () => {
  it("refuses an explicit thread that cannot be found", async () => {
    const result = await resolveEnvironment(bbWithEnvironments([{ id: "first" }], null), {
      projectId: "project",
      threadId: "missing",
    });
    assert.deepEqual(result, { outcome: "unavailable", reason: "thread missing was not found" });
  });

  it("refuses a thread from another project instead of selecting the first environment", async () => {
    const result = await resolveEnvironment(bbWithEnvironments([{ id: "first" }], "other"), {
      projectId: "project",
      threadId: "other-thread",
    });
    assert.deepEqual(result, {
      outcome: "unavailable",
      reason: "thread is not in this project's environments",
    });
  });

  it("requires a thread when a project has multiple environments", async () => {
    const result = await resolveEnvironment(
      bbWithEnvironments([{ id: "first" }, { id: "second" }], null),
      { projectId: "project" },
    );
    assert.deepEqual(result, {
      outcome: "unavailable",
      reason: "project has multiple environments; pass --thread <id>",
    });
  });

  it("refuses sync in a worktree before invoking Graphite", async () => {
    const result = await runVerb(
      bbWithEnvironments([{ id: "worktree", isWorktree: true }], "worktree"),
      { projectId: "project", threadId: "thread", verb: "sync" },
    );
    assert.deepEqual(result, {
      outcome: "refused",
      reason: "gt sync cannot run in a git worktree; fetch and restack instead",
    });
  });
});
