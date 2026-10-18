import { gettext as getText } from "i18n";
import { APP_NAME } from "../shared/brand";
import { formatError } from "../generated/lib/errors.js";
import { PlanConfiguration, CONFIGURATION_VERSION, SECONDS_PER_MINUTE } from "../generated/lib/configuration.js";
import { PHONE_STORAGE, SYNC_STATUS } from "../shared/sync";

const DEFAULT_TIME_SLOT_LENGTH = "90";
const colors = { ink: "#1b3028", muted: "#59665f", accent: "#1b4938" };
const labelStyle = {
  display: "block",
  fontSize: "14px",
  fontWeight: "600",
  color: colors.ink,
  marginBottom: "8px",
};
const inputStyle = {
  display: "block",
  width: "100%",
  boxSizing: "border-box",
  padding: "12px",
  border: "1px solid #d5dcd6",
  borderRadius: "8px",
  backgroundColor: "#ffffff",
  color: colors.ink,
  fontSize: "16px",
  lineHeight: "1.6",
  whiteSpace: "pre-wrap",
  overflowWrap: "anywhere",
};
const hintStyle = {
  display: "block",
  marginTop: "8px",
  fontSize: "13px",
  lineHeight: "1.5",
  color: colors.muted,
};

function translate(key, params = {}) {
  return getText(key).replace(/\{(\w+)\}/g, (placeholder, name) =>
    String(params[name] ?? placeholder)
  );
}

function onTimeChanges(storage, newValue) {
  if (!/^\d+$/.test(newValue)) return;

  const minutes = Number(newValue);
  if (!Number.isSafeInteger(minutes) || minutes <= 0) return;

  storage.setItem("draftTimeSlotLength", newValue);
  storage.setItem("syncStatus", "plan.sync.pending");
}

function onPlanChanges(storage, newValue) {
  storage.setItem("draftPlanContent", newValue);
  storage.setItem("syncStatus", "plan.sync.pending");
}

AppSettingsPage({
  build(props) {
    const storage = props.settingsStorage;
    const planText =
      storage.getItem("draftPlanContent") ?? getText("plan.content.default");
    const timeSlotLength = String(
      storage.getItem("draftTimeSlotLength") ?? DEFAULT_TIME_SLOT_LENGTH
    );
    const configuration = PlanConfiguration.fromObject({
      version: CONFIGURATION_VERSION, 
      revision: "draft", 
      planText,
      slotSeconds: Number(timeSlotLength) * SECONDS_PER_MINUTE,
    });
    const error = configuration.ok ? "" : formatError(configuration.error, getText);
    const canSave = configuration.ok;
    const content = [
      View(
        {
          style: {
            display: "flex",
            flexDirection: "column",
            marginBottom: "28px",
          },
        },
        [
          Text(
            {
              style: {
                display: "block",
                fontSize: "28px",
                fontWeight: "700",
                color: colors.ink,
                marginBottom: "8px",
              },
            },
            APP_NAME
          ),
          Text(
            {
              style: {
                display: "block",
                fontSize: "15px",
                lineHeight: "1.6",
                color: colors.muted,
              },
            },
            getText("settings.instructions")
          ),
        ]
      ),
      View({ style: { marginBottom: "24px" } }, [
        TextInput({
          label: getText("plan.time-slot.label"),
          placeholder: getText("plan.time-slot.placeholder"),
          labelStyle,
          subStyle: inputStyle,
          value: timeSlotLength,
          onChange: (value) => onTimeChanges(storage, value),
        }),
        Text({ style: hintStyle }, getText("plan.time-slot.hint")),
      ]),
      View({ style: { marginBottom: "20px" } }, [
        TextInput({
          label: getText("plan.content.label"),
          placeholder: getText("plan.content.placeholder"),
          labelStyle,
          subStyle: inputStyle,
          multiline: true,
          rows: 8,
          value: planText,
          onChange: (value) => onPlanChanges(storage, value),
        }),
        Text({ style: hintStyle }, getText("plan.content.hint")),
      ]),
    ];

    if (error) {
      content.push(
        Text(
          {
            style: {
              display: "block",
              padding: "12px",
              marginBottom: "20px",
              borderRadius: "8px",
              backgroundColor: "#fceeea",
              color: "#9b3020",
              fontSize: "14px",
              lineHeight: "1.5",
            },
          },
          error
        )
      );
    } else {
      content.push(
        Text(
          {
            style: {
              display: "block",
              padding: "12px 0",
              marginBottom: "16px",
              borderTop: "1px solid #d5dcd6",
              color: colors.muted,
              fontSize: "14px",
              lineHeight: "1.5",
            },
          },
          translate("plan.summary", {
            chapters: configuration.value.plan.totalItems,
            minutes:
              Math.round((configuration.value.plan.totalDurationInSeconds / 60) * 10) / 10,
          })
        )
      );
    }

    const saveButtonStyle = {
      display: "block", width: "100%", boxSizing: "border-box",
      backgroundColor: canSave ? colors.accent : "#d5dcd6",
      color: canSave ? "#ffffff" : colors.muted,
      border: "none", borderRadius: "8px", padding: "14px 16px",
      fontSize: "15px", fontWeight: "600", textAlign: "center",
    };

    content.push(
      canSave ? Button({
        label: getText("plan.save.label"),
        style: saveButtonStyle,
        onClick: () => commitPlanToWatch(storage),
      }) : Text({ style: saveButtonStyle }, getText("plan.save.label")),
      Text(
        { style: { ...hintStyle, marginTop: "12px" } },
        getText(storage.getItem("syncStatus") ?? "plan.sync.pending")
      )
    );

    return View(
      {
        style: {
          display: "flex",
          flexDirection: "column",
          width: "100%",
          minHeight: "100vh",
          boxSizing: "border-box",
          padding: "28px 20px",
          backgroundColor: "#f5f3ec",
        },
      },
      [
        View(
          {
            style: {
              display: "flex",
              flexDirection: "column",
              width: "100%",
              maxWidth: "520px",
              margin: "0 auto",
            },
          },
          content
        ),
      ]
    );
  },
});

function commitPlanToWatch(storage) {
  const planText =
    storage.getItem("draftPlanContent") ?? getText("plan.content.default");
  const timeSlot = String(
    storage.getItem("draftTimeSlotLength") ?? DEFAULT_TIME_SLOT_LENGTH
  );

  const configuration = PlanConfiguration.fromObject({
    version: CONFIGURATION_VERSION,
    revision: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    planText,
    slotSeconds: Number(timeSlot) * SECONDS_PER_MINUTE,
  });
  if (!configuration.ok) return;

  storage.setItem(PHONE_STORAGE.configuration, JSON.stringify(configuration.value));
  storage.setItem(PHONE_STORAGE.status, SYNC_STATUS.saved);
}
