import { LocalStorage } from "@zos/storage";

export const WATCH_STORAGE = { session: "talksplit.session", alarm: "talksplit.chapter-alarm" };
export const SESSION_VERSION = 1;

const STORAGE_FILES = {
  [WATCH_STORAGE.session]: "talksplit-session.json",
  [WATCH_STORAGE.alarm]: "talksplit-chapter-alarm.json",
};

/**
 * Reads a JSON record from its own file, separate from other watch records.
 * Returns null for missing or malformed JSON
 */
export function readWatchValue(key) {
  const storage = new LocalStorage(STORAGE_FILES[key]);
  let text = storage.getItem(key);

  if (typeof text !== "string") return null;

  try {
    return JSON.parse(text);
  } catch (error) {
    console.log(`Could not parse watch record: ${key}`);
    return null;
  }
}

export function writeWatchValue(key, value) {
  const storage = new LocalStorage(STORAGE_FILES[key]);
  storage.setItem(key, JSON.stringify(value));
}
