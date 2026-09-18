# Testing setup

Test against a separate BB instance. Do not install a plugin under development into
the live instance.

## How BB resolves its data directory

Verified by reading the installed BB `0.43.1` server bundle.

- `BB_DATA_DIR` overrides the data directory outright. A leading `~` expands. An
  empty value throws.
- With no override in production mode, the data directory is `~/.bb`, the server port
  is `38886`, and the host daemon port is `38887`.
- With no override in development mode, the data directory is
  `~/.bb-dev/<instanceId>`, with server ports allocated from base `19000` and host
  daemon ports from base `27000`, offset per repository root.

So a separate instance needs three variables:

```sh
BB_DATA_DIR=~/.bb-dev/graphite
BB_SERVER_PORT=19100
BB_HOST_DAEMON_PORT=27100
```

Pick ports that do not collide with the live instance's `38886`/`38887` or with an
existing `~/.bb-dev/*` instance.

## Unverified

The launch invocation has not been tested. There is no `bb serve` command; the server
runs inside the desktop app. Before relying on this setup, determine and record here:

1. How to start a second server with those variables set — a second app instance, or
   the server binary directly.
2. How `bb` CLI calls are routed to it. `BB_SERVER_URL` exists and is the likely
   mechanism; confirm it.
3. Whether provider credentials and project bindings must be re-established in the
   new data directory.

Do not report the separate instance as working until all three are answered.

## The development loop

```sh
bb plugin build          # compile to dist/; no server required
bb plugin install .      # install from the local path
bb plugin dev            # watch sources, rebuild, reload on change
bb plugin logs graphite  # read bb.log output
bb plugin reload graphite
```

`bb plugin dev` is the inner loop. `bb plugin build` must succeed before install or
release.

## A scratch stack to test against

The plugin needs a real Graphite stack with at least two stacked branches plus trunk,
so that parent and child metadata refs both exist. Create one in a throwaway
repository rather than against real work — step 5 of the plan runs destructive verbs.
