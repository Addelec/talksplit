import * as ui from "@zos/ui";
import { Time } from "@zos/sensor";
import { getText } from "@zos/i18n";
import {
  onKey,
  offKey,
  KEY_DOWN,
  KEY_EVENT_CLICK,
  showToast,
} from "@zos/interaction";
import { timeText } from "../../../generated/lib/timer.js";
import { LAYOUT, COLORS } from "zosLoader:./index.page.[pf].layout.js";

import { BasePage } from "@zeppos/zml/base-page";
import {
  restoreSession,
  createSession,
  saveSession,
} from "../../../watch/session";
import { updateChapterAlarm } from "../../../watch/chapter-alarm";
import { APP_NAME } from "../../../shared/brand";
import { requestSavedPlan, acknowledgeSavedPlan, watchSyncTime } from "../../../watch/sync";

const REFRESH_INTERVAL_MS = 200;
const SYNC_TIMEOUT_MS = 3000;
const START_SCREEN_WIDGETS = ["appName", "startButton", "syncButton", "planFooter"];
const MILLISECONDS_PER_SECOND = 1000;
const TALK_TEXT_WIDGETS = [
  "clock", "elapsed", "chapter", "remaining", "delta",
];

Page(
  BasePage({
    /** Restores a talk from storage if the app was closed */
    onInit() {
      this.clock = new Time();

      const restored = restoreSession();
      this.configuration = restored ? restored.configuration : null;
      this.timer = restored ? restored.timer : null;
      this.lastSyncedAt = restored ? restored.lastSyncedAt : null;
      this.isSynchronizing = false;
      this.isDestroyed = false;
      this.widgets = {};
      this.renderedProperties = {};

      if (restored) this.persistSession();
    },

    build() {
      ui.createWidget(ui.widget.FILL_RECT, LAYOUT.background);

      // Create text widgets
      for (const name of TALK_TEXT_WIDGETS) {
        this.widgets[name] = ui.createWidget(ui.widget.TEXT, {
          ...LAYOUT[name],
          text: "",
        });
      }

      // Create main button
      this.widgets.button = ui.createWidget(ui.widget.BUTTON, {
        ...LAYOUT.button,
        text: getText("watch.start-button"),
        click_func: () => this.advance(),
      });

      // Create start button
      this.widgets.startButton = ui.createWidget(ui.widget.BUTTON, {
        ...LAYOUT.startButton,
        text: getText("watch.start-button"),
        click_func: () => this.startTalk(),
      });
      this.widgets.appName = ui.createWidget(ui.widget.TEXT, {
        ...LAYOUT.appName,
        text: APP_NAME,
      });
      this.widgets.syncButton = ui.createWidget(ui.widget.BUTTON, {
        ...LAYOUT.syncButton,
        text: getText("watch.sync-button"),
        click_func: () => this.syncPlan(),
      });
      this.widgets.planFooter = ui.createWidget(ui.widget.TEXT, {
        ...LAYOUT.planFooter,
        text: "",
      });
      this.render();

      onKey((key, event) => {
        // Undo if KEY_DOWN is pressed.
        if (key !== KEY_DOWN || event !== KEY_EVENT_CLICK) return false;

        if (this.isSynchronizing || !this.timer) return true;
        
        this.timer.undo()
        this.persistSession();
        this.render();

        return true;
      });

      this.tick = setInterval(() => this.render(), REFRESH_INTERVAL_MS);
    },

    /** Advance the timer and persist. */
    advance() {
      if (this.isSynchronizing || !this.timer) return;

      this.timer.advance(this.clock.getTime());
      this.persistSession();
      this.render();
    },
    
    /** Save the current session to watch storage. */
    persistSession() {
      if (!this.timer) return;
      try {
        saveSession(this.configuration, this.timer, this.lastSyncedAt);

        // Update deadline alarm so the alarm is scheduled even if the app is closed.
        const alarmReady = updateChapterAlarm(
          this.configuration,
          this.timer,
          this.clock.getTime()
        );

        if (!alarmReady) showToast({ text: getText("watch.alarm-failed") });
      } catch (error) {
        console.log("Could not save talk session", error);
        showToast({ text: getText("watch.save-failed") });
      }
    },
    

    /** Starts the saved plan immediately, without contacting the phone. */
    startTalk() {
      if (this.isSynchronizing || this.isDestroyed || !this.timer) return;
      if (this.timer.snapshot(this.clock.getTime()).status !== "idle") return;

      this.timer.advance(this.clock.getTime());
      this.persistSession();
      this.render();
    },

    /** Saves a phone plan and its local sync time without starting the talk. */
    async syncPlan() {
      if (this.isSynchronizing || this.isDestroyed) return;
      if (this.timer && this.timer.snapshot(this.clock.getTime()).status !== "idle") return;

      this.isSynchronizing = true;
      this.render();
      let receivedRevision = null;
      try {
        const configuration = await requestSavedPlan(this, SYNC_TIMEOUT_MS);
        if (this.isDestroyed) return;
        const session = createSession(configuration);
        const lastSyncedAt = watchSyncTime(this.clock);
        saveSession(session.configuration, session.timer, lastSyncedAt);
        this.configuration = session.configuration;
        this.timer = session.timer;
        this.lastSyncedAt = lastSyncedAt;
        receivedRevision = configuration.revision;
      } catch (error) {
        if (!this.isDestroyed) {
          console.log("Could not sync plan", error);
          showToast({ text: getText("watch.sync-failed") });
        }
      } finally {
        this.isSynchronizing = false;
      }

      if (this.isDestroyed) return;
      this.render();
      if (receivedRevision) this.confirmPlanReceived(receivedRevision);
    },

    async confirmPlanReceived(revision) {
      try {
        const acknowledged = await acknowledgeSavedPlan(this, revision);
        if (!acknowledged && !this.isDestroyed) {
          showToast({ text: getText("watch.acknowledgment-failed") });
        }
      } catch (error) {
        if (!this.isDestroyed) showToast({ text: getText("watch.acknowledgment-failed") });
      }
    },

    setWidgetProperty(name, property, value) {
      const key = `${name}:${property}`;
      if (this.renderedProperties[key] === value) return;
      this.widgets[name].setProperty(property, value);
      this.renderedProperties[key] = value;
    },

    render() {
      const snapshot = this.timer ? this.timer.snapshot(this.clock.getTime()) : null;
      const showStartScreen = !snapshot || snapshot.status === "idle";
      for (const name of START_SCREEN_WIDGETS) {
        this.setWidgetProperty(name, ui.prop.VISIBLE, showStartScreen);
      }
      this.setWidgetProperty("button", ui.prop.VISIBLE, !showStartScreen);
      for (const name of TALK_TEXT_WIDGETS) {
        this.setWidgetProperty(name, ui.prop.VISIBLE, !showStartScreen);
      }
      if (showStartScreen) {
        const canStart = !!this.timer && !this.isSynchronizing;
        this.setWidgetProperty("startButton", ui.prop.COLOR, canStart ? COLORS.text : COLORS.disabled);
        this.setWidgetProperty("syncButton", ui.prop.TEXT,
          getText(this.isSynchronizing ? "watch.syncing" : "watch.sync-button"));
        const footer = this.configuration
          ? `${timeText(this.configuration.plan.totalDurationInSeconds * MILLISECONDS_PER_SECOND)} / ${this.lastSyncedAt || getText("watch.sync-time-unknown")}`
          : getText("watch.no-saved-plan");
        this.setWidgetProperty("planFooter", ui.prop.TEXT, footer);
        return;
      }

      const {
        status,
        item,
        elapsedInMilliseconds,
        remainingInMilliseconds,
        slotDurationInMilliseconds,
        delta,
        isLastChapter,
      } = snapshot;

      // Helper function to set text on widgets
      const set = (name, value) =>
        this.setWidgetProperty(name, ui.prop.TEXT, value);

      // Set the current time, elapsed time, current chapter etc.
      set(
        "clock",
        `${String(this.clock.getHours()).padStart(2, "0")}:${String(
          this.clock.getMinutes()
        ).padStart(2, "0")}`
      );
      set(
        "elapsed",
        `${timeText(elapsedInMilliseconds)} / ${timeText(slotDurationInMilliseconds)}`
      );
      set("chapter", item.title);
      set("remaining", timeText(remainingInMilliseconds, true).replace(/^-/, ""));
      this.setWidgetProperty(
        "remaining",
        ui.prop.COLOR,
        remainingInMilliseconds < 0 ? COLORS.red : COLORS.text
      );
      set(
        "delta",
        `${delta > 0 ? "+" : delta < 0 ? "-" : ""}${timeText(
          Math.abs(delta)
        )}`
      );

      // Set color depending on if we are ahead or behind schedule
      this.setWidgetProperty(
        "delta",
        ui.prop.COLOR,
        delta > 0 ? COLORS.red : COLORS.green
      );


      // Set the button text
      set(
        "button",
        getText(
          status === "finished"
            ? "watch.reset-button"
            : status === "idle"
            ? "watch.start-button"
            : isLastChapter
            ? "watch.finish-button"
            : "watch.next-button"
        )
      );
    },

    onDestroy() {
      this.isDestroyed = true;
      this.persistSession();
      clearInterval(this.tick);
      offKey();
    },
  })
);
