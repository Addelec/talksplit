import { Time } from "@zos/sensor";
import { handleChapterAlarm } from "../watch/chapter-alarm";

// Service to trigger chapter overrun alarm (vibration)
AppService({
  onInit(parameter) {
    try {
      const alarm = JSON.parse(parameter);
      handleChapterAlarm(alarm.token, new Time().getTime());
    } catch (error) {
      console.log("Chapter vibration failed", error);
    }
  },
});
