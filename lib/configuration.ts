import { Plan, PlanParseError } from "./plan";
import Duration, { DurationParseError } from "./duration";
import type { DisplayableError, ErrorParams } from "./errors";
import type { Result } from "./result";
import { success, failure } from "./result";

export const CONFIGURATION_VERSION = 1;
export const SECONDS_PER_MINUTE = 60;
export const DEFAULT_SLOT_MINUTES = 90;

/** Plan and configuration to be synced to the watch. */
export interface SavedPlanConfiguration {
  readonly version: typeof CONFIGURATION_VERSION;
  readonly revision: string;
  readonly planText: string;
  readonly slotSeconds: number;
}

/** Class representing a validated talk configuration. */
export class PlanConfiguration {
  readonly version = CONFIGURATION_VERSION;

  private constructor(
    public readonly revision: string,
    public readonly planText: string,
    public readonly slotSeconds: number,
    public readonly plan: Plan
  ) {}

  /**
   * Parse a configuration from an object.
   */
  static fromObject(
    value: Object
  ): Result<PlanConfiguration, ConfigurationParseError> {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      return failure(ConfigurationParseError.invalidFormat());
    }

    const input = value as Record<string, string | number>;

    if (input.version !== CONFIGURATION_VERSION) {
      return failure(ConfigurationParseError.unsupportedVersion());
    }
    if (typeof input.revision !== "string" || !input.revision.trim()) {
      return failure(ConfigurationParseError.missingRevision());
    }
    if (typeof input.planText !== "string") {
      return failure(ConfigurationParseError.invalidFormat());
    }
    if (typeof input.slotSeconds !== "number") {
      return failure(ConfigurationParseError.invalidSlot());
    }


    const duration = Duration.fromInteger(input.slotSeconds);

    if (!duration.ok) return failure(ConfigurationParseError.invalidSlot(duration.error));


    const plan = Plan.fromString(input.planText);

    if (!plan.ok) return failure(ConfigurationParseError.invalidPlan(plan.error));

    if (plan.value.totalDurationInSeconds > input.slotSeconds) {
      return failure(
        ConfigurationParseError.slotTooShort(
          plan.value.totalDurationInSeconds,
          input.slotSeconds
        )
      );
    }


    return success(
      new PlanConfiguration(
        input.revision,
        input.planText,
        input.slotSeconds,
        plan.value
      )
    );
  }

  /**
   * Returns a json serializable object.
   * Used for sending.
   */
  toJSON(): SavedPlanConfiguration {
    return {
      version: this.version,
      revision: this.revision,
      planText: this.planText,
      slotSeconds: this.slotSeconds,
    };
  }
}

export class ConfigurationParseError extends Error implements DisplayableError {
  readonly type = "configuration-parse-error";
  readonly detail?: DisplayableError;

  private constructor(
    public readonly code: string,
    public readonly params: ErrorParams = {},
    options: { detail?: DisplayableError } = {}
  ) {
    super(code);
    this.name = "ConfigurationParseError";
    this.detail = options.detail;
  }

  /** The input is not a configuration record or contains incorrect fields. */
  static invalidFormat(): ConfigurationParseError {
    return new ConfigurationParseError("configuration.invalid-format");
  }

  /** The format is unsupported. */
  static unsupportedVersion(): ConfigurationParseError {
    return new ConfigurationParseError("configuration.unsupported-version", {
      version: CONFIGURATION_VERSION,
    });
  }

  /** The revision is missing. */
  static missingRevision(): ConfigurationParseError {
    return new ConfigurationParseError("configuration.missing-revision");
  }

  /** A required slot is missing or invalid. So either invalid format or duration error. */
  static invalidSlot(detail?: DurationParseError): ConfigurationParseError {
    return new ConfigurationParseError(
      detail
        ? "configuration.invalid-slot-detail"
        : "configuration.invalid-slot",
      {},
      { detail }
    );
  }

  /** Plan is invalid. */
  static invalidPlan(detail: PlanParseError): ConfigurationParseError {
    return new ConfigurationParseError(
      "configuration.invalid-plan",
      {},
      { detail }
    );
  }

  /** The timeslot is too short for the plans total duration. */
  static slotTooShort(
    plannedSeconds: number,
    slotSeconds: number
  ): ConfigurationParseError {
    return new ConfigurationParseError("configuration.slot-too-short", {
      plannedSeconds,
      slotSeconds,
    });
  }
}
