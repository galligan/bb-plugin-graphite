# Graphite for BB

Read and drive [Graphite](https://graphite.dev) stacks from BB.

> **Status: scaffolded, not implemented.** Nothing below works yet. This README
> describes the intended shape so the build has a target.

## Why

BB has no Graphite support — nothing native, and nothing in the plugin store. Stacked
work is currently driven by hand in a terminal, which means an agent coordinating a
stack has to shell out, parse human-readable output, and guess at state.

## What it does

**Reads the stack from git, not from the CLI.** Graphite records its topology as git
refs, so the stack graph, each branch's recorded head, and its validation state are
all available as structured data. No output parsing, no interactive prompts, no auth.

**Reports what the CLI cannot.** Because the recorded head and the actual head are
both readable, the plugin can tell you when Graphite's view of a branch is stale —
something `gt log` does not print.

**Drives the small set of operations stacked work needs.** `restack`, `submit`,
`sync`, and `merge`, invoked non-interactively, with a working-tree check before
anything destructive.

**Answers to agents and people the same way.** One snapshot, rendered as text for a
terminal and as `--json` for an agent.

## Planned surface

```sh
bb graphite stack            # the current stack, with head, state, and staleness
bb graphite stack --json     # the same snapshot, for agents
```

Write verbs land after the read path is proven. See
[`.agents/plans/20260918-init/`](.agents/plans/20260918-init/).

## Not in scope

- Resolving conflicts. A conflict goes back to a person or a builder agent.
- Automatic merge policy. Merging is operator-invoked.
- Jujutsu and GitButler. Different models; generalizing early would be a guess.
- Replacing `gt`. This drives it.

## License

MIT
