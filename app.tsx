// bb-plugin-graphite — a BB plugin frontend entry.
//
// Compiled by `bb plugin build` into dist/app.js + dist/app.css. React and
// @get-bb/plugin-sdk/app are provided by the BB app at load time (never bundled),
// so this file must be loaded by BB, not imported directly.
//
// The components under components/ui/ are YOURS: vendored source (shadcn
// model), edit freely. Add more from the BB registry with
// `npx shadcn add @bb/<name>` (see components.json) — dropdowns, tables,
// the full shadcn set, version-matched to this BB install. Run
// `npm install` once before `bb plugin build`.
import { useCallback, useEffect, useState } from "react";
import type { FormEvent, ReactNode } from "react";
import { definePluginApp, useBbContext, useRealtime, useRpc } from "@get-bb/plugin-sdk/app";
import type { rpcContract, Todo } from "./server";
import type { CurrentStack } from "./lib/current-stack.ts";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Icon } from "@/components/ui/icon";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  StackPositionIcon,
  STACK_ICON_REGISTRATIONS,
} from "@/components/icons/stack-position.tsx";

/** The todo list, kept current by the server's "todos-changed" signal. */
function useTodos() {
  const rpc = useRpc<typeof rpcContract>();
  const [todos, setTodos] = useState<Todo[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const report = useCallback((cause: unknown) => {
    setError(cause instanceof Error ? cause.message : String(cause));
  }, []);
  const refetch = useCallback(() => {
    rpc.call("todos_list").then((result) => {
      setTodos(result.todos);
      setError(null);
    }, report);
  }, [rpc, report]);
  useEffect(() => {
    refetch();
  }, [refetch]);
  // server.ts publishes after every write — from this page, another window,
  // or `bb graphite add` run by an agent — so the list never goes stale.
  useRealtime("todos-changed", refetch);
  return { rpc, todos, error, report, refetch };
}

function TodoRow({
  todo,
  onToggle,
  onRemove,
}: {
  todo: Todo;
  onToggle: (done: boolean) => void;
  onRemove: () => void;
}) {
  return (
    <li className="flex items-center gap-3 py-2.5 text-sm">
      <Checkbox
        checked={todo.done}
        onCheckedChange={(checked) => onToggle(checked === true)}
        aria-label={`Mark "${todo.title}" ${todo.done ? "not done" : "done"}`}
      />
      <span
        className={cn(
          "min-w-0 flex-1 truncate",
          todo.done && "text-muted-foreground line-through",
        )}
      >
        {todo.title}
      </span>
      <span className="hidden font-mono text-xs text-muted-foreground sm:inline">
        {todo.id}
      </span>
      <Button
        variant="ghost"
        size="icon"
        className="size-7 text-muted-foreground hover:text-foreground"
        aria-label={`Remove "${todo.title}"`}
        onClick={onRemove}
      >
        <Icon name="Trash2" className="size-4" />
      </Button>
    </li>
  );
}

/** The dashed box BB's own list pages use for loading and empty states. */
function EmptyState({ children }: { children: ReactNode }) {
  return (
    <div
      role="status"
      className="rounded-lg border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground"
    >
      {children}
    </div>
  );
}

// Tailwind classes compile against the host theme's live CSS variables —
// derive colors from the theme tokens, never hardcoded grays. The frame
// (scrolling page, centered column) matches BB's own nav-panel pages.
function TodosPage() {
  const { rpc, todos, error, report, refetch } = useTodos();
  const [title, setTitle] = useState("");
  const [pending, setPending] = useState(false);
  const add = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const next = title.trim();
    if (next === "" || pending) return;
    setPending(true);
    try {
      await rpc.call("todos_add", { title: next });
      setTitle("");
      refetch();
    } catch (cause) {
      report(cause);
    } finally {
      setPending(false);
    }
  };
  const doneCount = todos?.filter((todo) => todo.done).length ?? 0;
  return (
    <div className="h-full min-h-0 flex-1 overflow-y-auto">
      <div className="mx-auto box-border w-full max-w-3xl px-4 pb-4 pt-3 md:px-5 md:pt-4">
        <p className="text-sm text-muted-foreground">
          Agents keep this list with <code>bb graphite</code>; the skill in{" "}
          <code>skills/example-todos</code> tells them how.
        </p>
        <form onSubmit={add} className="mt-4 flex items-center gap-2">
          <Input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="What needs doing?"
            aria-label="New todo"
          />
          <Button type="submit" disabled={pending || title.trim() === ""}>
            <Icon name="Plus" className="size-4" />
            Add
          </Button>
        </form>
        {error === null ? null : (
          <p role="alert" className="mt-3 text-sm text-destructive">
            {error}
          </p>
        )}
        <div className="mt-4">
          {todos === null ? (
            <EmptyState>Loading todos…</EmptyState>
          ) : todos.length === 0 ? (
            <EmptyState>
              Nothing to do. Add one above, or run{" "}
              <code>bb graphite add "Ship it"</code>.
            </EmptyState>
          ) : (
            <ul className="divide-y divide-border overflow-hidden rounded-lg border border-border bg-card px-4">
              {todos.map((todo) => (
                <TodoRow
                  key={todo.id}
                  todo={todo}
                  onToggle={(done) => {
                    rpc
                      .call("todos_set_done", { id: todo.id, done })
                      .then(refetch, report);
                  }}
                  onRemove={() => {
                    rpc
                      .call("todos_remove", { id: todo.id })
                      .then(refetch, report);
                  }}
                />
              ))}
            </ul>
          )}
        </div>
        {todos !== null && todos.length > 0 ? (
          <p className="mt-2 text-xs text-muted-foreground">
            {doneCount} of {todos.length} done
          </p>
        ) : null}
      </div>
    </div>
  );
}

// The default export must be definePluginApp(...); BB interprets it after
// loading the bundle. navPanel adds a page to the left sidebar; register
// other UI under app.slots and composer actions, plus-menu rows, banners, or
// rich-text rules with app.composer.customize(...) (see the bb guide's
// plugins chapter).

/**
 * The quiet default: one row above the composer, only when there is a stack to
 * report. `chrome: "card"` gives it the same bounding BB's own diff bar uses, so
 * the two rows line up; the inner classes mirror that bar's as well.
 *
 * Renders null when there is no stack, which collapses BB's banner region to
 * zero height.
 */
function StackBanner() {
  const rpc = useRpc<typeof rpcContract>();
  const { projectId, threadId } = useBbContext();
  const [stack, setStack] = useState<CurrentStack | null>(null);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    if (projectId === null) {
      setStack(null);
      return;
    }
    let live = true;
    rpc.call("stack_current", { projectId, threadId }).then(
      (result) => {
        if (live) setStack(result);
      },
      () => {
        if (live) setStack(null);
      },
    );
    return () => {
      live = false;
    };
  }, [rpc, projectId, threadId]);

  if (stack === null || stack.outcome !== "stacked") return null;

  // Sentence case, so the row always opens on a capital the way BB's own do.
  const state = stack.needsRestack ? "Needs restack" : stack.isStale ? "Drifted" : null;
  // Tip first, the way `gt ls` prints it: trunk is the last line, not the first.
  const rows = [...stack.branches].reverse();
  const trunkName = stack.branches[0]?.name ?? "trunk";

  return (
    // Structure copied from BB's own diff bar so the two rows share a baseline:
    // a p-1 wrapper, then a min-h-6 px-2 py-1 button. That is what puts our icon
    // at the same x as theirs and makes both cards the same height.
    <div className="text-xs text-muted-foreground">
      <div className="flex items-center gap-0.5 p-1">
        <button
          type="button"
          onClick={() => setExpanded((open) => !open)}
          aria-expanded={expanded}
          className="flex min-h-6 min-w-0 cursor-pointer items-center gap-1.5 overflow-hidden rounded px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-state-hover"
        >
          <StackPositionIcon position={stack.placement} className="size-3.5 shrink-0" />
          <span className="min-w-0 truncate tabular-nums">
            {stack.position}/{stack.total}
          </span>
          {state !== null ? (
            <span className="shrink-0 text-warning-text">{state}</span>
          ) : null}
          <Icon
            name="ChevronDown"
            className={cn(
              "size-3.5 shrink-0 text-subtle-foreground transition-transform duration-200",
              expanded && "rotate-180",
            )}
          />
        </button>
      </div>
      <div
        className={cn(
          "grid overflow-hidden transition-[grid-template-rows,opacity,border-color] duration-200 ease-out",
          expanded
            ? "grid-rows-[1fr] border-t border-border opacity-100"
            : "pointer-events-none grid-rows-[0fr] border-t border-transparent opacity-0",
        )}
      >
        <div className="overflow-hidden bg-popover">
          <ol className="max-h-56 overflow-auto px-3 pb-2 pt-1">
            {rows.map((branch, index) => (
              <li
                key={branch.name}
                className="grid grid-cols-[1.5rem_minmax(0,1fr)_auto] items-center gap-x-3 rounded px-1"
              >
                <LineageNode
                  first={index === 0}
                  last={index === rows.length - 1}
                  current={branch.isCurrent}
                />
                <span
                  className={cn(
                    "truncate text-xs leading-5",
                    branch.isCurrent
                      ? "font-medium text-foreground"
                      : "opacity-70",
                  )}
                >
                  {branch.name}
                </span>
                {branch.needsRestack ? (
                  <span className="shrink-0 text-xs leading-5 text-warning-text">
                    needs restack
                  </span>
                ) : null}
              </li>
            ))}
          </ol>
          {stack.otherStacks.length > 0 ? (
            <p className="border-t border-border px-3 py-1.5 text-xs leading-5 text-subtle-foreground">
              {stack.otherStacks.length} other stack
              {stack.otherStacks.length === 1 ? "" : "s"} off{" "}
              <span className="font-mono">{trunkName}</span>
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}

/**
 * One node on the stack spine, in the 1.5rem column BB reserves for a row glyph.
 * Reads like `gt ls`: a filled node for the branch you are on, hollow for the rest,
 * joined by a continuous line so the lineage is visible rather than implied.
 */
function LineageNode({
  first,
  last,
  current,
}: {
  readonly first: boolean;
  readonly last: boolean;
  readonly current: boolean;
}) {
  return (
    <svg viewBox="0 0 24 20" className="h-5 w-6 shrink-0" aria-hidden="true">
      <line
        x1="12"
        y1={first ? 10 : 0}
        x2="12"
        y2={last ? 10 : 20}
        stroke="currentColor"
        strokeWidth="1"
        opacity="0.3"
      />
      <circle
        cx="12"
        cy="10"
        r="3.5"
        fill={current ? "currentColor" : "var(--popover)"}
        stroke="currentColor"
        strokeWidth="1.25"
        opacity={current ? 1 : 0.55}
      />
    </svg>
  );
}

export default definePluginApp((app) => {
  for (const icon of STACK_ICON_REGISTRATIONS) app.experimental_icons.register(icon);
  app.composer.customize({
    id: "stack",
    banners: [{ id: "stack-position", chrome: "card", component: StackBanner }],
  });
  app.slots.navPanel({
    id: "example-todos",
    title: "Example todos",
    icon: "ListTodo",
    // Routed at /plugins/graphite/example-todos; the component receives the
    // remainder as `subPath` for deep links within the page.
    path: "example-todos",
    component: TodosPage,
  });
});
