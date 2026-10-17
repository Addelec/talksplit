import type { Plan, PlanItem } from "./plan";
import { PlanCursor } from "./plan";
import type { Result } from "./result";
import { success, failure } from "./result";

const MILLISECONDS_PER_SECOND = 1000;

/**
 * State required to build a TalkTimer.
 * Used for restoring of app state after the watch closes the app or goes to sleep.
 */
export interface TimerState {
  readonly startedAt: number | null;
  readonly endedAt: number | null;
  readonly splits: readonly number[];
}

export type TimerStatus = "idle" | "running" | "finished";

/** Formatting function for time values in milliseconds. */
export function timeText(milliseconds: number, countdown = false): string {
  const seconds = countdown && milliseconds > 0
    ? Math.ceil(milliseconds / 1000)
    : Math.floor(Math.abs(milliseconds) / 1000);
  
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  const sign = milliseconds < 0 && seconds > 0 ? "-" : "";

  return `${sign}${minutes < 10 ? "0" : ""}${minutes}:${remainder < 10 ? "0" : ""}${remainder}`;
}

export interface TimerSnapshot {
  readonly status: TimerStatus;
  readonly index: number;
  readonly total: number;
  readonly item: PlanItem;
  readonly isLastChapter: boolean;

  readonly elapsedInMilliseconds: number;
  readonly remainingInMilliseconds: number;
  readonly slotRemainingInMilliseconds: number;
  readonly slotDurationInMilliseconds: number;

  /** Delta to plan => positive means behind schedule, negative means ahead. */
  readonly delta: number;
}

/** TalkTimer class. */
export class TalkTimer {
  private startedAt: number | null = null;
  private endedAt: number | null = null;
  private splits: number[] = [];
  private readonly cursor: PlanCursor;

  constructor(
    private readonly plan: Plan,
    private readonly slotSeconds: number = plan.totalDurationInSeconds,
  ) {
    this.cursor = new PlanCursor(plan);
  }

  /**
   * Serialize to TimerState for persistence.
   */
  serialize(): TimerState {
    return { startedAt: this.startedAt, endedAt: this.endedAt, splits: [...this.splits] };
  }

  /**
   * Restores a TalkTimer from a plan, slotLengthInSeconds, and a saved TimerState.
   *
   * @param plan The parsed chapter plan belonging to the saved session.
   * @param slotLengthInSeconds The total time slot for the talk in seconds.
   * @param saved The timer state as returned by serialize()
   * @returns The restored timer from Storage
   */
  static restore(plan: Plan, slotLengthInSeconds: number, saved: TimerState): Result<TalkTimer, string> {

    if (!Number.isSafeInteger(slotLengthInSeconds) || slotLengthInSeconds <= 0) return failure("Invalid slot duration");

    if (!saved || typeof saved !== "object") return failure("Missing timer state");

    const state = saved as TimerState;
    if (!Array.isArray(state.splits) || state.splits.length >= plan.totalItems) {
      return failure("Invalid chapter history");
    }
    const isTimestamp = (value: unknown): value is number =>
      typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
    if (state.startedAt === null) {
      if (state.endedAt !== null || state.splits.length) return failure("Invalid idle state");
    } else {
      if (!isTimestamp(state.startedAt)) return failure("Invalid start time");
      let previousTimestamp = state.startedAt;
      for (const split of state.splits) {
        if (!isTimestamp(split) || split < previousTimestamp) return failure("Invalid split time");
        previousTimestamp = split;
      }
      if (state.endedAt !== null && (!isTimestamp(state.endedAt) || state.endedAt < previousTimestamp)) {
        return failure("Invalid finish time");
      }
      if (state.endedAt !== null && state.splits.length !== plan.totalItems - 1) {
        return failure("Finished before the final chapter");
      }
    }
    const timer = new TalkTimer(plan, slotLengthInSeconds);
    timer.startedAt = state.startedAt;
    timer.endedAt = state.endedAt;
    timer.splits = [...state.splits];
    for (const split of state.splits) timer.cursor.next();
    return success(timer);
  }

  /**
   * Get the current chapter deadline as a timestamp.
   */
  get chapterDeadline(): number | null {
    if (this.startedAt === null || this.endedAt !== null) return null;
    const chapterStartedAt = this.splits[this.splits.length - 1] ?? this.startedAt;
    return chapterStartedAt + this.cursor.current.duration.toSeconds * MILLISECONDS_PER_SECOND;
  }

  /** Start, advance a chapter, finish, or reset a finished session. */
  advance(now: number): void {
    if (this.endedAt !== null) {
      this.reset();
    } else if (this.startedAt === null) {
      this.startedAt = now;
    } else {
      const timestamp = Math.max(now, this.splits[this.splits.length - 1] ?? this.startedAt);
      if (!this.cursor.hasNext) {
        this.endedAt = timestamp;
      } else {
        this.splits.push(timestamp);
        this.cursor.next();
      }
    }
  }

  /** Reset the timer to its initial state. */
  reset(): void {
    this.startedAt = null;
    this.endedAt = null;
    this.splits = [];
    this.cursor.reset();
  }

  /** Undo => Remove the latest split and resume from the prior chapter. */
  undo(): boolean {
    // If the timer is finished just set it to unfinished.
    if (this.endedAt !== null) {
      this.endedAt = null;
      return true;
    }

    // If there is not previous chapter => nothing to undo.
    if (!this.cursor.hasPrevious) return false;

    this.splits.pop();
    this.cursor.previous();
    return true;
  }

  /**
   * Create a timer snapshot.
   * @param now The current timestamp in milliseconds
   * @returns The TimerSnapshot
   */
  snapshot(now: number): TimerSnapshot {
    const index = this.cursor.position;
    const item = this.cursor.current;
    const chapterStart = this.splits[index - 1] ?? this.startedAt;
    const currentTime = this.endedAt ?? Math.max(now, chapterStart ?? now);
    const elapsedInMilliseconds = this.startedAt === null ? 0 : currentTime - this.startedAt;
    const chapterElapsed = chapterStart === null ? 0 : currentTime - chapterStart;
    const remainingInMilliseconds = item.duration.toSeconds * 1000 - chapterElapsed;
    const plannedEnd = this.plan.items.slice(0, index + 1)
      .reduce((sum, chapter) => sum + chapter.duration.toSeconds * 1000, 0);
    const status: TimerStatus = this.endedAt !== null ? "finished"
      : this.startedAt === null ? "idle" : "running";

    return {
      status, index, item,
      total: this.cursor.total,
      isLastChapter: !this.cursor.hasNext,
      elapsedInMilliseconds: elapsedInMilliseconds,
      remainingInMilliseconds: remainingInMilliseconds,
      slotRemainingInMilliseconds: this.slotSeconds * 1000 - elapsedInMilliseconds,
      slotDurationInMilliseconds: this.slotSeconds * MILLISECONDS_PER_SECOND,
      // Project this chapter's finish, including previous overruns/early splits.
      delta: status === "idle" ? 0
        : elapsedInMilliseconds + (status === "running" ? Math.max(0, remainingInMilliseconds) : 0) - plannedEnd,
    };
  }
}
