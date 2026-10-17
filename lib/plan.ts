import type { Result } from "./result";
import { success, failure } from "./result";
import Duration, { DurationParseError } from "./duration";
import type { DisplayableError, ErrorParams } from "./errors";

export class Plan {
  public readonly totalDurationInSeconds: number;

  private constructor(public readonly items: readonly PlanItem[]) {
    this.totalDurationInSeconds = items.reduce((acc, item) => acc + item.duration.toSeconds, 0);
  }

  get totalItems(): number {
    return this.items.length;
  }

  static fromString(planString: string): Result<Plan, PlanParseError> {
    const lines = planString.split("\n");
    const items: PlanItem[] = [];
    
    for (const [index, line] of lines.entries()) {
      if (line.trim() === "") {
        continue; // Skip empty lines
      }

      if (line.trim().startsWith("#")) {
        continue; // Skip comment lines
      }

      const result = PlanItem.fromString(line);

      if (!result.ok) {
        return failure(PlanParseError.failedPlanItem(result.error, index + 1));
      }
      
      items.push(result.value);
    }

    if (items.length === 0) {
      return failure(PlanParseError.emptyPlan(planString));
    }
    
    return success(new Plan(items));
  }
}

export class PlanCursor {
  private currentIndex: number = 0;

  constructor(private readonly plan: Plan) {}

  get current(): PlanItem {
    // Plans are nonempty, and navigation keeps the index within bounds.
    return this.plan.items[this.currentIndex];
  }

  reset(): void {
    this.currentIndex = 0;
  }

  next(): PlanItem | null {
    if (this.hasNext) {
      this.currentIndex++;
      return this.plan.items[this.currentIndex];
    }
    return null;
  }

  get hasNext(): boolean {
    return this.currentIndex < this.plan.items.length - 1;
  }

  previous(): PlanItem | null {
    if (this.hasPrevious) {
      this.currentIndex--;
      return this.plan.items[this.currentIndex];
    }
    return null;
  }

  get hasPrevious(): boolean {
    return this.currentIndex > 0;
  }


  get position(): number {
    return this.currentIndex;
  }

  get total(): number {
    return this.plan.items.length;
  }
}

export class PlanItem {
  private static readonly MAX_TITLE_LENGTH = 20;

  private static readonly LINE_PATTERN = /^(\S+)(?:\s+(.+))?$/;
  private static readonly MINUTES_TITLE_PATTERN = /^(\d+)$/;
  private static readonly MINUTES_SECONDS_TITLE_PATTERN = /^(\d+):([0-5]\d)$/;
  private static readonly HOURS_MINUTES_SECONDS_TITLE_PATTERN =
    /^(\d+):([0-5]\d):([0-5]\d)$/;

  public readonly title: string;
  public readonly duration: Duration;

  private constructor(title: string, duration: Duration) {
    this.title = title;
    this.duration = duration;
  }

  static fromString(line: string): Result<PlanItem, PlanItemParseError> {
    const match = PlanItem.LINE_PATTERN.exec(line.trim());

    if (!match) {
      return failure(PlanItemParseError.invalidFormat(line));
    }

    const durationString = match[1];
    const title = match[2] ? match[2].trim() : "";

    if (!title || title.trim() === "") {
      return failure(PlanItemParseError.missingTitle(line));
    }

    if (title.length > PlanItem.MAX_TITLE_LENGTH) {
      return failure(
        PlanItemParseError.titleTooLong(
          line,
          PlanItem.MAX_TITLE_LENGTH,
          title.length
        )
      );
    }

    const minutesTitleMatch =
      PlanItem.MINUTES_TITLE_PATTERN.exec(durationString);
    const minutesSecondsTitleMatch =
      PlanItem.MINUTES_SECONDS_TITLE_PATTERN.exec(durationString);
    const hoursMinutesSecondsTitleMatch =
      PlanItem.HOURS_MINUTES_SECONDS_TITLE_PATTERN.exec(durationString);

    let seconds = 0;

    if (minutesTitleMatch) {
      const _minutes = parseInt(minutesTitleMatch[1], 10);
      seconds = _minutes * 60;
    } else if (minutesSecondsTitleMatch) {
      const _minutes = parseInt(minutesSecondsTitleMatch[1], 10);
      const _seconds = parseInt(minutesSecondsTitleMatch[2], 10);
      seconds = _minutes * 60 + _seconds;
    } else if (hoursMinutesSecondsTitleMatch) {
      const _hours = parseInt(hoursMinutesSecondsTitleMatch[1], 10);
      const _minutes = parseInt(hoursMinutesSecondsTitleMatch[2], 10);
      const _seconds = parseInt(hoursMinutesSecondsTitleMatch[3], 10);
      seconds = _hours * 3600 + _minutes * 60 + _seconds;
    } else {
      return failure(PlanItemParseError.invalidDuration(line));
    }

    const duration = Duration.fromInteger(seconds);

    if (!duration.ok) {
      return failure(PlanItemParseError.invalidDuration(line, duration.error));
    }

    return success(new PlanItem(title, duration.value));
  }
}

export class PlanParseError extends Error implements DisplayableError {
  readonly type = "plan-parse-error";
  readonly detail?: DisplayableError;
  readonly input?: string;
  
  private constructor(
    public readonly code: string,
    public readonly params: ErrorParams,
    options: { detail?: DisplayableError; input?: string } = {},
  ) {
    super(code);
    this.name = "PlanParseError";
    this.detail = options.detail;
    this.input = options.input;
  }

  static emptyPlan(input: string): PlanParseError {
    return new PlanParseError("plan.empty", {}, { input });
  }

  static failedPlanItem(itemError: PlanItemParseError, lineNumber: number): PlanParseError {
    return new PlanParseError("plan.line", { line: lineNumber }, { detail: itemError });
  }
}

export class PlanItemParseError extends Error implements DisplayableError {
  readonly type = "plan-item-parse-error";

  private constructor(
    public readonly code: string,
    public readonly params: ErrorParams,
    public readonly input: string,
    public readonly detail?: DisplayableError,
  ) {
    super(code);
    this.name = "PlanItemParseError";
  }

  static invalidDuration(input: string, durationError?: DurationParseError): PlanItemParseError {
    return new PlanItemParseError(
      durationError ? "plan.invalid-duration-detail" : "plan.invalid-duration",
      {}, input, durationError,
    );
  }

  static invalidFormat(input: string): PlanItemParseError {
    return new PlanItemParseError("plan.invalid-format", {}, input);
  }

  static missingTitle(input: string): PlanItemParseError {
    return new PlanItemParseError("plan.missing-title", {}, input);
  }
  
  static titleTooLong(
    input: string,
    maxLength: number,
    actualLength: number
  ): PlanItemParseError {
    return new PlanItemParseError("plan.title-too-long", {
      maxLength,
      actualLength,
    }, input);
  }

}
