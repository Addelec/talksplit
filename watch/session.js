import { TalkTimer } from "../generated/lib/timer.js";
import { PlanConfiguration } from "../generated/lib/configuration.js";
import {
  readWatchValue,
  writeWatchValue,
  WATCH_STORAGE,
  SESSION_VERSION,
} from "./storage";

/**
 * Restore a session from watch storage after reopening the app.
 */
export function restoreSession() {
  const saved = readWatchValue(WATCH_STORAGE.session);

  if (!saved) return null;
  if (saved.version !== SESSION_VERSION) {
    console.log("Could not restore session: unsupported version", saved.version);
    return null;
  }

  const configuration = PlanConfiguration.fromObject(saved.configuration);

  if (!configuration.ok) {
    console.log("Could not restore session configuration", configuration.error.code);
    return null;
  }

  const timer = TalkTimer.restore(
    configuration.value.plan,
    configuration.value.slotSeconds,
    saved.timerState
  );

  if (!timer.ok) {
    console.log("Could not restore timer state", timer.error);
    return null;
  }

  return { 
    configuration: configuration.value, 
    timer: timer.value,
    lastSyncedAt: typeof saved.lastSyncedAt === "string" ? saved.lastSyncedAt : null,
  }
}

/**
 * Save a restorable session to watch storage.
 */
export function saveSession(configuration, timer, lastSyncedAt = null) {
  writeWatchValue(WATCH_STORAGE.session, {
    version: SESSION_VERSION,
    configuration,
    timerState: timer.serialize(),
    lastSyncedAt,
  });
}

/**
 * Create a new session from a config.
 * This creates a new timer.
 */
export function createSession(configuration) {
  const parsed = PlanConfiguration.fromObject(configuration);

  if (!parsed.ok) throw parsed.error;

  return {
    configuration: parsed.value,
    timer: new TalkTimer(parsed.value.plan, parsed.value.slotSeconds),
  };
}
