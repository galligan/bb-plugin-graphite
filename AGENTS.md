# AGENTS.md

`bb-plugin-graphite` reads and drives Graphite stacks from BB.

Status: scaffolded, not implemented. The repository still contains the stock
`bb plugin new` todo example. Replace it; do not build around it.

## Read first

- [`docs/agents/graphite.md`](docs/agents/graphite.md) — what Graphite exposes, how to
  read the stack from git refs, which `gt` invocations are safe, and the gaps in BB.
  Written for agents.
- The `bb-plugin-dev` skill — verified BB SDK behavior, destructive hazards, and
  multi-machine rules. Covers what the built-in `bb-plugin-authoring` skill does not.
- The `bb-plugin-design` skill — scope, surface choice, and composition preferences.
- [`.agents/plans/20260918-init/`](.agents/plans/20260918-init/) — the current build
  plan and its done-conditions.

## Invariants

- Read stack topology from `refs/branch-metadata/*`. MUST NOT parse `gt` output.
- Read branch, head SHA, and dirty state from `bb.sdk.environments.status`. MUST NOT
  shell out to `git status` or `git rev-parse` for facts that call already returns.
- MUST NOT invoke `gt` in a form that can prompt. See the command reference in
  `docs/agents/graphite.md`.
- MUST NOT run a destructive `gt` or `git` operation without first checking
  `environments.status` and refusing on a non-`clean` working tree.
- Resolve the `gt` binary path. Do not assume it is on the server process's `PATH`.

## Conventions

- `docs/agents/` is for agent consumption. Write it in Agentish: one instruction per
  bullet, conditions before actions, named targets, no vague qualifiers.
- `docs/` otherwise is for people.
- State what is verified and what is not. When a fact comes from a specific version,
  name the version.
- Prefer a CLI command over a UI panel until a decision exists that a human cannot
  make from `--json` output.

## Verification

- `bb plugin build` must succeed before install.
- Test against a separate BB instance, not the live one. See
  [`.agents/plans/20260918-init/testing-setup.md`](.agents/plans/20260918-init/testing-setup.md).
