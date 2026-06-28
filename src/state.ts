import streamdeck from "@elgato/streamdeck";

/**
 * Shared, in-memory cache of the last brightness sent to each light, plus a
 * small request coalescer used by the dials.
 *
 * The amaran daemon runs an ~80ms-per-light status refresh after every command
 * and has no state read-back, so two things matter for responsiveness:
 *
 *  1. The CCT/HSI endpoints set brightness *and* colour together, so the CCT
 *     dial needs to know the current brightness or it would re-assert 100%.
 *     We keep that here, shared across actions, read/written synchronously.
 *  2. On a fast dial spin we must NOT fire (and await) one HTTP request per
 *     tick. The Coalescer below sends only the latest value and drops the
 *     intermediate ones while a request is in flight.
 */
interface GlobalState {
  levels?: Record<string, number>;
}

const memLevels = new Map<string, number>();
let hydrated = false;
let persistTimer: ReturnType<typeof setTimeout> | undefined;

function norm(lightId: string): string {
  return (lightId ?? "").trim();
}

/** Load persisted levels into memory once (survives plugin restarts). */
export async function hydrateLevels(): Promise<void> {
  if (hydrated) {
    return;
  }
  hydrated = true;
  try {
    const global = await streamdeck.settings.getGlobalSettings<GlobalState>();
    for (const [k, v] of Object.entries(global.levels ?? {})) {
      memLevels.set(k, v);
    }
  } catch {
    /* ignore — defaults are fine */
  }
}

/** Last brightness (0-100) sent to a light, if known. Synchronous. */
export function getLevelSync(lightId: string): number | undefined {
  return memLevels.get(norm(lightId));
}

/** Remember a brightness (0-100); persistence is debounced off the hot path. */
export function setLevelSync(lightId: string, level: number): void {
  const id = norm(lightId);
  if (!id) {
    return;
  }
  memLevels.set(id, Math.round(level));
  schedulePersist();
}

function schedulePersist(): void {
  if (persistTimer) {
    return;
  }
  persistTimer = setTimeout(async () => {
    persistTimer = undefined;
    try {
      const global = await streamdeck.settings.getGlobalSettings<GlobalState>();
      const levels: Record<string, number> = { ...(global.levels ?? {}) };
      for (const [k, v] of memLevels) {
        levels[k] = v;
      }
      await streamdeck.settings.setGlobalSettings({ ...global, levels });
    } catch {
      /* ignore persistence failures */
    }
  }, 600);
}

/**
 * Runs at most one task at a time; if asked again while running, keeps only the
 * most recent task and runs it after the current one finishes. This collapses a
 * burst of dial ticks into "send the latest value" instead of one call per tick.
 */
export class Coalescer {
  private running = false;
  private next?: () => Promise<void>;

  run(task: () => Promise<void>): void {
    this.next = task;
    if (!this.running) {
      void this.loop();
    }
  }

  private async loop(): Promise<void> {
    this.running = true;
    while (this.next) {
      const task = this.next;
      this.next = undefined;
      try {
        await task();
      } catch {
        /* errors surface via the action's own showAlert */
      }
    }
    this.running = false;
  }
}

const coalescers = new Map<string, Coalescer>();

/** A Coalescer scoped to a single action instance (by context id). */
export function coalescerFor(context: string): Coalescer {
  let c = coalescers.get(context);
  if (!c) {
    c = new Coalescer();
    coalescers.set(context, c);
  }
  return c;
}
