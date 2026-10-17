/**
 * Interface used for errors which can be displayed to the user.
 * Used with i18n for localization of error messages. 
 * Code is used to look up the error message in the localization file, and params are used to fill in any template strings in the error message.  
 * For example: code = "plan.invalid-duration", params = { line: 15 } can be used for template strings like "Invalid duration on line {line}" <= this string would be in the localization file under the key "plan.invalid-duration" = error code.
 */
export interface DisplayableError {
  /**
   * The error code, used for localization with i18n.
   * Example: plan.invalid-duration
   */
  readonly code: string;
  /**
   * The error parameters, used for localization with i18n.
   * Example: { line: 15 } can be used for template strings like "Invalid duration on line {line}" <= this string would be in the localization file under the key "plan.invalid-duration" = error code.
   */
  readonly params: ErrorParams;

  /**
   * Optional detail error, which can be used to provide more information about the error.
   * Example: If the error is "invalid-duration", the detail error could be a DurationParseError, which provides more information about why the duration is invalid.
   */
  readonly detail?: DisplayableError;
}

export type ErrorParams = Readonly<Record<string, string | number>>;

/** Serializes a displayable error for sync. */
export function serializeError(error: DisplayableError): DisplayableError {
  return {
    code: error.code,
    params: { ...error.params },
    ...(error.detail ? { detail: serializeError(error.detail) } : {}), // Recursively serialize detail error if it exists
  };
}

export function formatError(
  error: DisplayableError,
  translate: (key: string) => string,
): string {
  const params: Record<string, string | number> = { ...error.params };
  if (error.detail) {
    params.message = formatError(error.detail, translate);
  }
  return translate(error.code).replace(/\{(\w+)\}/g, (placeholder, name: string) =>
    String(params[name] ?? placeholder),
  );
}
