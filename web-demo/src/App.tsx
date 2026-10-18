import { createSignal, onCleanup, onMount, Show } from "solid-js";
import Swal from "sweetalert2";
import { Plan } from "../../lib/plan";
import { formatError } from "../../lib/errors";
import { TalkTimer, timeText, type TimerSnapshot } from "../../lib/timer";
import talkSplitIcon from "./assets/icon.svg";
import "./App.css";

const REFRESH_INTERVAL_MS = 200;
const EXAMPLE_PLAN =
  "10 Ten minute block\n07:30 MM:SS\n01:15:30 HH:MM:SS\n# This is a comment";
const ERROR_MESSAGES: Record<string, string> = {
  "plan.empty": "Add at least one chapter.",
  "plan.line": "Line {line}: {message}",
  "plan.invalid-format": "Enter a duration followed by a chapter title.",
  "plan.missing-title": "Add a chapter title after the duration.",
  "plan.title-too-long":
    "Keep chapter titles to {maxLength} characters (currently {actualLength}).",
  "plan.invalid-duration": "Use minutes, mm:ss, or hh:mm:ss for the duration.",
  "plan.invalid-duration-detail": "Invalid duration: {message}",
  "duration.not-safe-integer":
    "Use a whole number of seconds within the supported range.",
  "duration.not-positive": "The duration must be greater than zero.",
};

function App() {
  const [planText, setPlanText] = createSignal(EXAMPLE_PLAN);
  const [editorScrollTop, setEditorScrollTop] = createSignal(0);
  const lineCount = () => planText().split("\n").length;
  const lineNumbers = () =>
    Array.from({ length: lineCount() }, (_, index) => index + 1).join("\n");
  const [snapshot, setSnapshot] = createSignal<TimerSnapshot | null>(null);
  const [clockText, setClockText] = createSignal("");
  let timer: TalkTimer | null = null;
  const isRunning = () => snapshot()?.status === "running";

  function refreshWatch() {
    const now = new Date();
    setClockText(
      now.toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      })
    );
    setSnapshot(timer ? timer.snapshot(now.getTime()) : null);
  }

  onMount(() => {
    refreshWatch();
    const interval = window.setInterval(refreshWatch, REFRESH_INTERVAL_MS);
    onCleanup(() => window.clearInterval(interval));
  });

  /** Validates the editor and loads a new, idle timer into the browser preview. */
  function syncPlan(event: SubmitEvent) {
    event.preventDefault();
    if (isRunning()) return;
    const result = Plan.fromString(planText());
    if (!result.ok) {
      void Swal.fire({
        icon: "error",
        title: "Check your chapters",
        text: formatError(
          result.error,
          (key) => ERROR_MESSAGES[key] ?? "The plan could not be loaded."
        ),
        confirmButtonText: "Back to editing",
        buttonsStyling: false,
        customClass: {
          popup: "plan-error-popup",
          confirmButton: "popup-confirm",
        },
      });
      return;
    }
    timer = new TalkTimer(result.value);
    refreshWatch();
  }

  function advance() {
    timer?.advance(Date.now());
    refreshWatch();
  }

  function undo() {
    timer?.undo();
    refreshWatch();
  }

  return (
    <main class="demo-layout">
      <div class="column editor-column">
        <header class="hero">
          <img class="talk-split-icon" src={talkSplitIcon} alt="" />
          <h1>TalkSplit</h1>
        </header>

        <section class="overview" aria-labelledby="overview-heading">
          <h2 id="overview-heading">Like Livesplit but for presentations</h2>
          <p>
            Split your presentation into discrete chapters and get alerted if you are behind schedule.
          </p>
          <p>
            Try it in the simulator below.
          </p>
        </section>

        <form class="plan-form" onSubmit={syncPlan}>
          <fieldset disabled={isRunning()}>
            <label for="chapters">Talk chapters</label>
            <p class="field-hint" id="chapters-hint">
              {`Format: Duration (in mm, mm:ss, or hh:mm:ss) followed by a chapter title.
              Lines starting with # are comments.
              Only one chapter per line.`}
            </p>
            <div
              class="chapter-editor"
              style={{
                "--gutter-width": `${
                  Math.max(2, String(lineCount()).length) + 2
                }ch`,
              }}
            >
              <div class="line-number-gutter" aria-hidden="true">
                <pre
                  style={{ transform: `translateY(-${editorScrollTop()}px)` }}
                >
                  {lineNumbers()}
                </pre>
              </div>
              <textarea
                id="chapters"
                name="chapters"
                rows="7"
                spellcheck={false}
                wrap="off"
                aria-describedby="chapters-hint"
                onScroll={(event) =>
                  setEditorScrollTop(event.currentTarget.scrollTop)
                }
                value={planText()}
                onInput={(event) => {
                  setPlanText(event.currentTarget.value);
                }}
              />
            </div>
            <button class="sync-button" type="submit">
              Sync to simulator <span aria-hidden="true">→</span>
            </button>
          </fieldset>
        </form>
      </div>

      <section class="column simulator-column" aria-label="Watch simulator">
        <p class="simulator-heading">SIMULATOR</p>
        <div class="watch-face">
          <Show
            when={snapshot()}
            fallback={
              <div class="watch-empty">
                <span class="watch-brand">TalkSplit</span>
                <p>
                  Sync your plan
                  <br />
                  to get started.
                </p>
                <button disabled>Start</button>
              </div>
            }
          >
            {(current) => (
              <>
                <div class="watch-clock">{clockText()}</div>
                <div class="watch-elapsed">
                  {timeText(current().elapsedInMilliseconds)} /{" "}
                  {timeText(current().slotDurationInMilliseconds)}
                </div>
                <div class="watch-chapter">{current().item.title}</div>
                <div
                  class="watch-countdown"
                  classList={{ overdue: current().remainingInMilliseconds < 0 }}
                >
                  {timeText(current().remainingInMilliseconds, true).replace(
                    /^-/,
                    ""
                  )}
                </div>
                <div
                  class="watch-pace"
                  classList={{ overdue: current().delta > 0 }}
                >
                  {current().delta > 0 ? "+" : current().delta < 0 ? "−" : ""}
                  {timeText(Math.abs(current().delta))}
                </div>
                <button class="watch-next" onClick={advance}>
                  {current().status === "idle"
                    ? "Start"
                    : current().status === "finished"
                    ? "Reset"
                    : current().isLastChapter
                    ? "Finish"
                    : "Next chapter"}
                </button>
              </>
            )}
          </Show>
        </div>
        <div class="simulator-controls">
          <button
            onClick={undo}
            disabled={
              !snapshot() ||
              (snapshot()!.index === 0 && snapshot()!.status !== "finished")
            }
          >
            Undo chapter
          </button>
          <button
            onClick={() => {
              timer?.reset();
              refreshWatch();
            }}
            disabled={!snapshot() || snapshot()!.status === "idle"}
          >
            Reset talk
          </button>
        </div>
      </section>
    </main>
  );
}

export default App;
