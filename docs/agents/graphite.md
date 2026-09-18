# Graphite for agents

What a BB plugin can read from Graphite, what it must shell out for, and where the
gaps are.

Verified 2026-09-18 against Graphite CLI `1.8.6`. Re-verify the ref shape and flag
behavior when the CLI updates.

## Read the stack from git refs

Graphite records stack topology as git refs. Each tracked branch has one ref at
`refs/branch-metadata/<branch>` pointing to a blob of JSON.

```
$ git show-ref | grep branch-metadata
b6e255a6f6914a73cf5a394c85a502c0626ce66f refs/branch-metadata/main

$ git cat-file -p b6e255a6f6914a73cf5a394c85a502c0626ce66f
{
  "children": ["os-579-add-tobiluqmd-as-a-dependency…", "fix/unify-oxfmt-config"],
  "branchRevision": "fcbbea62e9777f2a0b8de3b7d5e98fad160a32fd",
  "validationResult": "TRUNK"
}
```

Read the stack this way. Do not parse `gt` output.

Observed fields:

- `children` — the branch names stacked directly on this branch. This is the edge
  set of the stack graph.
- `branchRevision` — the head commit Graphite believes this branch is at.
- `validationResult` — observed as `TRUNK` on trunk. The full range is unverified.

The set of branches with a `branch-metadata` ref is exactly the set Graphite
tracks. In a repository with 8 git branches and 1 metadata ref, `gt ls` rendered 1
branch. Untracked branches have no ref and do not appear.

### Unverified

The blob shape on a **non-trunk** branch has not been observed. The only repository
available at writing had a drained stack with one ref. Expect a parent branch name
and revision. **Confirm this before designing around it.** Create a two-branch stack
and read both refs.

### Derive staleness

Compare `branchRevision` against the branch's actual head:

```sh
git rev-parse <branch>
```

If they differ, Graphite's recorded view is behind the repository. Neither `gt ls`
nor `gt ll` prints this comparison.

## Do not shell out for worktree facts

`bb.sdk.environments.status({ environmentId, mergeBaseBranch })` returns the branch
name, exact head SHA, working-tree state, and ahead/behind counts against the merge
base. Use it instead of `git rev-parse` and `git status`.

See the `bb-plugin-dev` skill for the full response shape.

## Write through the `gt` CLI

`node:child_process.execFile` works from plugin backend code. Model the helper on
`gh-stack`'s, at
`~/Developer/bb/community/smsunarto-bb-plugins/plugins/gh-stack/server.ts:362`: pass
`cwd`, a timeout, and a `maxBuffer`, and resolve a result object rather than
throwing.

Two rules:

- `execFile` runs on the **BB server**. That is correct for a server-local
  workspace. For a workspace on an enrolled remote machine it silently runs against
  the wrong host. Either document the single-machine limitation or put the call in a
  `bb.host` module.
- `gt` is at `/Users/mg/.local/share/npm/bin/gt`. It may be absent from the server
  process's `PATH`. Resolve the binary; do not assume it is on `PATH`.

## Command reference

### No machine-readable output exists

- `gt log` has three forms: `gt log`, `gt log short` (alias `gt ls`), and
  `gt log long` (alias `gt ll`). None emit JSON.
- `gt ll` ignores all options and renders a commit-ancestry graph of all branches.
- `gt status` is **not a Graphite command**. It passes through to `git status` and
  reports working-tree state, not stack topology.

### Non-interactive invocation

An agent MUST NOT invoke `gt` in a form that can prompt.

- Pass `--no-interactive` to disable prompts, pagers, and editors.
- Pass `-f` to `undo`, `absorb`, `delete`, `sync`, and `abort`.
- Pass `--quiet` where minimal output is wanted; it implies `--no-interactive`.
- Pass `--message` / `-m` to `gt create` and `gt modify` so the command never waits
  on an editor.

### Corrections to widely-repeated guidance

Two errors appear in `~/.config/claude/rules/graphite.md`. Do not inherit them.

- `gt merge --confirm` does **not** skip prompts. `-c, --confirm` *asks*. Using it
  non-interactively fails with `Cannot perform interactive operation in
  non-interactive mode`. Use `--no-interactive`.
- `gt status` does not emit structured JSON with stack parentage. It is a `git
  status` passthrough.

### Worktree rule

MUST NOT run `gt sync` inside a git worktree. Run `git fetch origin` in the
worktree, then `gt restack`.

## Gaps in BB

Verified against BB `0.43.1` and the plugin store on 2026-09-18:

- BB has no native Graphite support. Zero matches in the server build.
- No Graphite plugin exists in the store.
- No Jujutsu plugin. No GitButler plugin.
- `GitHub Stack` (store name; `smsunarto/bb-plugins/plugins/gh-stack`) wraps the
  `gh stack` CLI from a thread panel. It is the closest working reference for a
  stacking plugin in BB.
- `bb.sdk.environments` provides `pullRequest`, `markPullRequestDraft`,
  `markPullRequestReady`, and `mergePullRequest`. There is no restack, rebase, or
  submit primitive.
- `bb.sdk.terminals` is an interactive PTY, not exec-and-capture. It is not the path
  for running `gt`.
