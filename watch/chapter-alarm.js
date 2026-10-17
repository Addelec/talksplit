import { set as scheduleAlarm, cancel as cancelAlarm } from "@zos/alarm";
import { Vibrator, VIBRATOR_SCENE_NOTIFICATION } from "@zos/sensor";
import { restoreSession } from "./session";
import { readWatchValue, writeWatchValue, WATCH_STORAGE } from "./storage";

const MILLISECONDS_PER_SECOND = 1000;
const ALARM_SERVICE_PATH = "app-service/chapter-overrun";

function createChapterIdentifier(configuration, timer) {
  const state = timer.serialize();
  if (timer.chapterDeadline === null) return null;
  // Re-entering the same chapter through undo retains its original identity.
  return `${configuration.revision}:${state.startedAt}:${state.splits.join(
    ","
  )}`;
}

/**
 * Function to update the chapter deadline alarm.
 */
export function updateChapterAlarm(configuration, timer, now) {
  const existing = readWatchValue(WATCH_STORAGE.alarm);

  const chapterIdentifier = createChapterIdentifier(configuration, timer);

  const deadline = timer.chapterDeadline;

  if (
    chapterIdentifier &&
    existing &&
    existing.token === chapterIdentifier &&
    (existing.handled || existing.alarmId)
  ) {
    // Deadline alarm correct => nothing to do ._.
    return true;
  }


  const previousTokens =
    existing && Array.isArray(existing.handledTokens)
      ? existing.handledTokens
      : [];
  
  const sessionStartedAt = timer.serialize().startedAt;
  const sessionPrefix = `${configuration.revision}:${sessionStartedAt}:`;

  const handledTokens =
    sessionStartedAt === null
      ? []
      : previousTokens.filter(
          (token) =>
            token.startsWith(sessionPrefix)
        );
  
  const record = {
    token: chapterIdentifier,
    deadline,
    alarmId: null,
    handled: false,
    handledTokens,
  };

  writeWatchValue(WATCH_STORAGE.alarm, record);

  // Cancel old alarm
  if (existing && existing.alarmId) {
    try {
      cancelAlarm(existing.alarmId);
    } catch (error) {
      console.log("Could not cancel old chapter alarm", error);
    }
  }

  // If the talk is finished return.
  if (!chapterIdentifier || deadline === null) return true;

  // If the deadline has passed or the chapter has already been handled, mark it as handled.
  if (deadline <= now || handledTokens.indexOf(chapterIdentifier) !== -1) {
    record.handled = true;
    writeWatchValue(WATCH_STORAGE.alarm, record);
    return true;
  }

  // Now if we have a valid chapter deadline, schedule the alarm.
  try {
    record.alarmId = scheduleAlarm({
      url: ALARM_SERVICE_PATH,
      time: Math.ceil(deadline / MILLISECONDS_PER_SECOND),
      store: true,
      param: JSON.stringify({ token: chapterIdentifier }),
    });

    writeWatchValue(WATCH_STORAGE.alarm, record);
    
    return Boolean(record.alarmId);
  } catch (error) {
    console.log("Could not schedule chapter alarm", error);
    return false;
  }
}

/**
 * Handles the chapter deadline alarm.
 * If there is a alarm scheduled, check if the deadline is overdue (just to be safe).
 */
export function handleChapterAlarm(token, now) {
  const record = readWatchValue(WATCH_STORAGE.alarm);

  if (!record || record.token !== token || record.handled) return;

  const session = restoreSession();

  if (
    !session ||
    createChapterIdentifier(session.configuration, session.timer) !== token ||
    session.timer.chapterDeadline === null ||
    session.timer.chapterDeadline > now
  ) {
    return;
  }

  record.handled = true;
  record.alarmId = null;
  record.handledTokens.push(token);
  writeWatchValue(WATCH_STORAGE.alarm, record);

  new Vibrator().start({ mode: VIBRATOR_SCENE_NOTIFICATION });
}
