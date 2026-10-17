import type { Result } from "./result";
import { success, failure } from "./result";
import type { DisplayableError, ErrorParams } from "./errors";

export default class Duration {
  private readonly seconds: number;

  private constructor(seconds: number) {
    this.seconds = seconds;
  }

  get toSeconds(): number {
    return this.seconds;
  }

  static fromString(string: string): Result<Duration, DurationParseError> {
    try {
      const seconds = Number(string);

      return Duration.fromInteger(seconds);
    } catch (error) {
      return failure(DurationParseError.notInteger(string));
    }
  }

  static fromInteger(seconds: number): Result<Duration, DurationParseError> {
    if (!Number.isSafeInteger(seconds)) {
      return failure(
        DurationParseError.notSafeInteger(seconds.toString())
      );
    }

    if (seconds <= 0) {
      return failure(DurationParseError.notPositive(seconds.toString()));
    }

    return success(new Duration(seconds));
  }
}

export class DurationParseError extends Error implements DisplayableError {
  readonly type = "duration-parse-error";

  private constructor(
    public readonly input: string,
    public readonly code: string,
    public readonly params: ErrorParams = {}
  ) {
    super(`Cannot parse duration: ${input}`);
    this.name = "DurationParseError";
  }

  static notSafeInteger(input: string): DurationParseError {
    return new DurationParseError(input, "duration.not-safe-integer");
  }

  static notPositive(input: string): DurationParseError {
    return new DurationParseError(input, "duration.not-positive");
  }

  static notInteger(input: string): DurationParseError {
    return new DurationParseError(input, "duration.not-integer");
  }
}
