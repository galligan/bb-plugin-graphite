# Graphite for BB

Read and drive [Graphite](https://graphite.dev) stacks from BB.

> **Status: the read path and the write verbs work.** Not yet released.

## Why

BB has no Graphite support — nothing native, and nothing in the plugin store. Stacked
work is currently driven by hand in a terminal, which means an agent coordinating a
stack has to shell out, parse human-readable output, and guess at state.

## What it does

## What works

```sh
bb graphite stack            # the stack around the checked-out branch
bb graphite stack --json     # the same snapshot, for agents
bb graphite restack | submit | sync | merge
```

Plus a `graphite_stack` agent tool and a row above the composer showing where the
branch sits, what needs a restack, and which thread is on each branch.

**Reads the stack from stored state, not from CLI output.** Graphite keeps its
topology in a SQLite database inside your git directory, so the stack graph, each
branch's recorded head, and its validation state are all available as structured
data. No output parsing, no interactive prompts, no auth.

**Reports what the CLI cannot.** Because the recorded head and the actual head are
both readable, the plugin can tell you when Graphite's view of a branch is stale —
something `gt log` does not print. It can only do that by *not* running `gt`: every
`gt` command, including `gt log`, silently refreshes the recorded head first.

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

Every write verb refuses a working tree that is not `clean` unless you pass
`--force`. See [`.agents/plans/20260918-init/`](.agents/plans/20260918-init/).

## What it couples to

This plugin reads `.graphite_metadata.db`, a private file Graphite writes inside your
git directory. Graphite does not document it, version it, or offer an alternative:
there is no `--json`, no export, and no machine-readable interop surface in the CLI as
of `1.8.6`.

Reading it is a deliberate trade. It is the only way to see a branch whose recorded
head has fallen behind the repository, and it is the only structured source there is.
The cost is that a Graphite release could change the schema.

Two things bound that risk. The plugin opens the database **read-only** and never
writes to it. And it checks Graphite's own migration list on every read, naming any
migration it does not recognize rather than guessing. All Graphite repositories
observed so far report the same three migrations, whose ids are dated within nine days
of each other in early 2026; each database applies them when the CLI first opens it.

If you are not comfortable with that coupling, do not install this plugin.

## Not in scope

- Resolving conflicts. A conflict goes back to a person or a builder agent.
- Automatic merge policy. Merging is operator-invoked.
- Jujutsu and GitButler. Different models; generalizing early would be a guess.
- Replacing `gt`. This drives it.

## License

MIT
