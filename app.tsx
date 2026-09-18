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
import {
  definePluginApp,
  useBbContext,
  useBbNavigate,
  useRealtime,
  useRpc,
} from "@get-bb/plugin-sdk/app";
import type { rpcContract, Todo } from "./server";
import type {
  CurrentStack,
  CurrentStackBranch,
  CurrentStackOffshoot,
  CurrentStackThread,
} from "./lib/current-stack.ts";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Icon } from "@/components/ui/icon";
import { HugeiconsIcon } from "@hugeicons/react";
import { ChatIcon } from "@hugeicons/core-free-icons";
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
  const [openBranches, setOpenBranches] = useState<ReadonlySet<string>>(new Set());

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
  // One lane width for every row, so branch names line up whether or not the row
  // has columns beside it — the way `gt ls` keeps a single name column.
  const lanes = Math.max(
    0,
    ...rows
      .filter((branch) => openBranches.has(branch.name))
      .map((branch) => laneWidth(branch.offshoots)),
  );

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
        <div className="overflow-hidden rounded-b-[7px] bg-popover">
          <ol className="max-h-72 overflow-auto p-1">
            {rows.map((branch, index) => (
              <StackRow
                key={branch.name}
                branch={branch}
                first={index === 0}
                last={index === rows.length - 1}
                open={openBranches.has(branch.name)}
                onToggle={() =>
                  setOpenBranches((current) => {
                    const next = new Set(current);
                    if (next.has(branch.name)) next.delete(branch.name);
                    else next.add(branch.name);
                    return next;
                  })
                }
                laneWidth={lanes}
              />
            ))}
          </ol>
        </div>
      </div>
    </div>
  );
}

/** One branch on the spine, plus its offshoots when they are shown. */
function StackRow({
  branch,
  first,
  last,
  open,
  onToggle,
  laneWidth: lanes,
}: {
  readonly branch: CurrentStackBranch;
  readonly first: boolean;
  readonly last: boolean;
  readonly open: boolean;
  readonly onToggle: () => void;
  readonly laneWidth: number;
}) {
  const count = branch.offshoots.length;
  const showOffshoots = open && count > 0;

  return (
    <li>
      {/* Offshoots sit above the branch they hang off, the way `gt ls` stacks them,
          so the parent's row is where the columns join. */}
      {showOffshoots
        ? layoutOffshoots(branch.offshoots).map((row) => (
            <div
              key={row.offshoot.name}
              className="grid grid-cols-[0.875rem_auto_minmax(0,1fr)] items-center gap-x-1.5 rounded px-2"
            >
              <LineageNode first={first} last={last} current={false} passthrough />
              <OffshootLanes row={row} width={lanes} />
              <span className="flex min-w-0 items-center gap-1.5">
                <span className="truncate text-xs leading-5 opacity-55">
                  {row.offshoot.name}
                </span>
                {row.offshoot.needsRestack ? <RestackMark /> : null}
                <ThreadMarks threads={row.offshoot.threads} />
              </span>
            </div>
          ))
        : null}
      <div className="grid grid-cols-[0.875rem_auto_minmax(0,1fr)] items-center gap-x-1.5 rounded px-2">
        <LineageNode
          first={first}
          last={last}
          current={branch.isCurrent}
          join={showOffshoots}
        />
        {showOffshoots ? (
          <ChainJoin
            columns={branch.offshoots
              .filter((offshoot) => offshoot.parent === null)
              .map((offshoot) => offshoot.column)}
            width={lanes}
          />
        ) : (
          <span style={{ width: lanes }} className="shrink-0" />
        )}
        <span className="flex min-w-0 items-center gap-1.5">
          <span
            className={cn(
              "truncate text-xs leading-5",
              branch.isCurrent ? "font-medium text-foreground" : "opacity-70",
            )}
          >
            {branch.name}
          </span>
          {branch.needsRestack ? <RestackMark /> : null}
          <ThreadMarks threads={branch.threads} />
          {count > 0 ? (
            <button
              type="button"
              onClick={onToggle}
              aria-expanded={open}
              aria-label={`${count} branch${count === 1 ? "" : "es"} off ${branch.name}`}
              className="flex shrink-0 cursor-pointer items-center gap-0.5 rounded px-1 text-2xs leading-4 text-subtle-foreground transition-colors hover:bg-state-hover hover:text-foreground"
            >
              <Icon
                name="ChevronRight"
                className={cn("size-3 transition-transform duration-150", open && "rotate-90")}
              />
              {count}
            </button>
          ) : null}
        </span>
      </div>
    </li>
  );
}

const LANE = 14;

interface OffshootRow {
  readonly offshoot: CurrentStackOffshoot;
  /** Columns with a line passing straight through this row. */
  readonly through: readonly number[];
  /** A branch in the same column joins this row from above. */
  readonly fromAbove: boolean;
  /** Columns that close into this row, drawn as the elbow of `◯─┘`. */
  readonly closes: readonly number[];
}

function laneWidth(offshoots: readonly CurrentStackOffshoot[]): number {
  return Math.max(1, ...offshoots.map((offshoot) => offshoot.column)) * LANE;
}

/**
 * Works out, for each row, which columns have a line running through it and which
 * close into it. Offshoots arrive in post-order, so a branch always appears after
 * its descendants and every line runs downward to the row it joins.
 */
function layoutOffshoots(offshoots: readonly CurrentStackOffshoot[]): OffshootRow[] {
  const indexOf = new Map(offshoots.map((offshoot, index) => [offshoot.name, index]));
  // A row whose parent is not an offshoot joins the chain branch, below every row.
  const parentRow = offshoots.map((offshoot) =>
    offshoot.parent === null ? offshoots.length : (indexOf.get(offshoot.parent) ?? offshoots.length),
  );

  return offshoots.map((offshoot, index) => {
    const through: number[] = [];
    let fromAbove = false;
    const closes: number[] = [];
    for (let other = 0; other < index; other += 1) {
      if (parentRow[other] > index) through.push(offshoots[other].column);
      if (parentRow[other] !== index) continue;
      if (offshoots[other].column === offshoot.column) fromAbove = true;
      else closes.push(offshoots[other].column);
    }
    return { offshoot, through: [...new Set(through)], fromAbove, closes };
  });
}

/**
 * The elbows on the chain branch's own row, where every column hanging off it
 * turns in and closes — the `◯─┴─┘` at the foot of a fork in `gt ls`.
 */
function ChainJoin({
  columns,
  width,
}: {
  readonly columns: readonly number[];
  readonly width: number;
}) {
  const x = (column: number) => (column - 1) * LANE + 7;
  return (
    <svg
      viewBox={`0 0 ${width} 20`}
      width={width}
      height={20}
      className="shrink-0"
      aria-hidden="true"
    >
      <g stroke="currentColor" strokeWidth="1" opacity="0.3" fill="none">
        {columns.map((column) => (
          <path key={column} d={`M${x(column)} 0 V10 H-6`} />
        ))}
      </g>
    </svg>
  );
}

function OffshootLanes({ row, width }: { readonly row: OffshootRow; readonly width: number }) {
  const x = (column: number) => (column - 1) * LANE + 7;
  const own = x(row.offshoot.column);
  return (
    <svg
      viewBox={`0 0 ${width} 20`}
      width={width}
      height={20}
      className="shrink-0"
      aria-hidden="true"
    >
      <g stroke="currentColor" strokeWidth="1" opacity="0.3" fill="none">
        {row.through.map((column) => (
          <line key={column} x1={x(column)} y1="0" x2={x(column)} y2="20" />
        ))}
        {row.fromAbove ? <line x1={own} y1="0" x2={own} y2="6.75" /> : null}
        <line x1={own} y1="13.25" x2={own} y2="20" />
        {/* the elbow: the closing column drops to this row, then turns into the node */}
        {row.closes.map((column) => (
          <path key={column} d={`M${x(column)} 0 V10 H${own + 3.25}`} />
        ))}
      </g>
      <circle
        cx={own}
        cy="10"
        r="3.25"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.25"
        opacity="0.4"
      />
    </svg>
  );
}

/**
 * A thread working on this branch. Hover names it, click opens it.
 * `gt ls` prints the worktree path here; a thread is the thing you actually want.
 */
function ThreadMarks({ threads }: { readonly threads: CurrentStackThread[] }) {
  const navigate = useBbNavigate();
  if (threads.length === 0) return null;
  return (
    <span className="flex shrink-0 items-center gap-0.5">
      {threads.map((thread) => (
        <button
          key={thread.id}
          type="button"
          title={thread.title}
          aria-label={`Open thread: ${thread.title}`}
          onClick={(event) => {
            event.stopPropagation();
            navigate.toThread(thread.id);
          }}
          className="group/thread flex max-w-[14rem] cursor-pointer items-center gap-1 rounded-md px-1 py-0.5 text-xs text-muted-foreground transition-colors hover:bg-state-hover hover:text-foreground"
        >
          <HugeiconsIcon icon={ChatIcon} className="size-3 shrink-0" />
          {/* Collapsed to the glyph until hover, then the pill grows to name the thread. */}
          <span className="max-w-0 overflow-hidden whitespace-nowrap opacity-0 transition-all duration-150 group-hover/thread:max-w-[12rem] group-hover/thread:opacity-100">
            {thread.title}
          </span>
        </button>
      ))}
    </span>
  );
}

/** A branch on an offshoot column: its own ring, no spine of its own. */
function OffshootNode() {
  return (
    <svg viewBox="0 0 14 20" className="h-5 w-3.5 shrink-0" aria-hidden="true">
      <circle cx="7" cy="10" r="2.75" fill="none" stroke="currentColor" strokeWidth="1.25" opacity="0.4" />
    </svg>
  );
}

/** Orange mark beside a branch name. Replaces the "needs restack" text on every row. */
function RestackMark() {
  return (
    <span
      title="Needs restack"
      aria-label="Needs restack"
      role="img"
      className="flex size-3.5 shrink-0 items-center justify-center rounded-full border border-warning-text text-2xs font-semibold leading-none text-warning-text"
    >
      !
    </span>
  );
}

/**
 * One node on the stack spine, in the icon column BB reserves for a row glyph.
 * Reads like `gt ls`: a filled node for the branch you are on, hollow for the rest,
 * joined by a continuous line so the lineage is visible rather than implied.
 */
function LineageNode({
  first,
  last,
  current,
  passthrough = false,
  join = false,
}: {
  readonly first: boolean;
  readonly last: boolean;
  readonly current: boolean;
  readonly passthrough?: boolean;
  /** Draw the elbow that closes an offshoot column into this node, like `◯─┘`. */
  readonly join?: boolean;
}) {
  // The line stops short of each node rather than passing behind it, so a hollow
  // node reads as a ring and not as a crossed-out circle.
  return (
    <svg viewBox="0 0 14 20" className="h-5 w-3.5 shrink-0" aria-hidden="true">
      {passthrough ? (
        <line x1="7" y1="0" x2="7" y2="20" stroke="currentColor" strokeWidth="1" opacity="0.3" />
      ) : (
        <>
          {first ? null : (
            <line x1="7" y1="0" x2="7" y2="5.5" stroke="currentColor" strokeWidth="1" opacity="0.3" />
          )}
          {last ? null : (
            <line x1="7" y1="14.5" x2="7" y2="20" stroke="currentColor" strokeWidth="1" opacity="0.3" />
          )}
          {join ? (
            <path
              d="M10.25 10H14"
              stroke="currentColor"
              strokeWidth="1"
              opacity="0.3"
              fill="none"
            />
          ) : null}
          <circle
            cx="7"
            cy="10"
            r="3.25"
            fill={current ? "currentColor" : "none"}
            stroke="currentColor"
            strokeWidth="1.25"
            opacity={current ? 1 : 0.55}
          />
        </>
      )}
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
