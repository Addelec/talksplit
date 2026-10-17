import { BaseSideService, settingsLib } from "@zeppos/zml/base-side";
import { PlanConfiguration } from "../generated/lib/configuration.js";
import { serializeError } from "../generated/lib/errors.js";
import { PHONE_STORAGE, SYNC_METHOD, SYNC_STATUS } from "../shared/sync";

AppSideService(
  BaseSideService({
    /**
     * Handles watch requests using the configuration saved by the phone settings.
     * GET_PLAN returns validated data; ACK_PLAN confirms only the current plan.
     */
    onRequest(request, respond) {
      try {
        const saved = settingsLib.getItem(PHONE_STORAGE.configuration);

        if (!saved) {
          respond(null, { error: "sync.no-saved-plan" });
          return;
        }

        const configuration = PlanConfiguration.fromObject(JSON.parse(saved));
        if (!configuration.ok) {
          respond(null, { error: serializeError(configuration.error) });
          return;
        }

        switch (request.method) {
          case SYNC_METHOD.getPlan:
            respond(null, { configuration: configuration.value });
            break;

          case SYNC_METHOD.acknowledgePlan:
            const matchesSavedRevision =
              request.params &&
              request.params.revision === configuration.value.revision;
              
            if (
              matchesSavedRevision &&
              settingsLib.getItem(PHONE_STORAGE.status) === SYNC_STATUS.saved
            ) {
              settingsLib.setItem(PHONE_STORAGE.status, SYNC_STATUS.received);
            }
            respond(null, { acknowledged: Boolean(matchesSavedRevision) });
            break;

          default:
            respond(null, { error: "sync.unknown-request" });
        }
      } catch (error) {
        respond(null, { error: "sync.invalid-plan" });
      }
    },
  })
);
