import { PlanConfiguration } from "../generated/lib/configuration.js";
import { SYNC_METHOD } from "../shared/sync";

const REQUEST_TIMEOUT_MS = 10000;

async function requestWithTimeout(page, request, timeoutInMilliseconds) {
  let timeoutHandle;
  const timeout = new Promise((resolve, reject) => {
    timeoutHandle = setTimeout(() => reject(new Error("Sync request timed out")), timeoutInMilliseconds);
  });
  try {
    return await Promise.race([
      page.request(request, { timeout: timeoutInMilliseconds }),
      timeout,
    ]);
  } finally {
    clearTimeout(timeoutHandle);
  }
}

/**
 * Requests the saved plan from the phone.
 */
export async function requestSavedPlan(page, timeoutInMilliseconds = REQUEST_TIMEOUT_MS) {
  const response = await requestWithTimeout(page, { method: SYNC_METHOD.getPlan }, timeoutInMilliseconds);

  if (response.error) {
    throw typeof response.error === "string" ? new Error(response.error) : response.error; // Deal with nested errors
  }

  const configuration = PlanConfiguration.fromObject(response.configuration);

  if (!configuration.ok) throw configuration.error;

  return configuration.value;
}

/**
 * Send an ack that the plan has been received.
 */
export async function acknowledgeSavedPlan(page, revision) {
  const response = await page.request({ method: SYNC_METHOD.acknowledgePlan, params: { revision } },
    { timeout: REQUEST_TIMEOUT_MS });
  return response.acknowledged === true;
}

export function watchSyncTime(clock) {
  const pad = (value) => String(value).padStart(2, "0");
  return `${pad(clock.getDate())}.${pad(clock.getMonth())} ${pad(clock.getHours())}:${pad(clock.getMinutes())}`;
}
