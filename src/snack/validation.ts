import { ApplicationFailure } from "@temporalio/workflow";

export const SNACK_CHECK_VALIDATION_ERROR = "SnackCheckResultValidationError";

// The part of a Zod 3 or Zod 4 schema this module relies on.
export interface ActivityResultSchema<T> {
  safeParse(
    raw: unknown,
  ):
    | { success: true; data: T }
    | { success: false; error: { issues: { path: PropertyKey[]; message: string }[] } };
}

export function parseActivityResult<T>(raw: unknown, schema: ActivityResultSchema<T>): T {
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    const fields = [
      ...new Set(parsed.error.issues.map((issue) => String(issue.path[0] ?? "<root>"))),
    ];
    // A plain ZodError would only fail the workflow task and retry it forever. A non-retryable
    // ApplicationFailure fails the workflow execution loudly instead.
    throw ApplicationFailure.nonRetryable(
      `invalid activity result: ${fields.join(", ")}`,
      SNACK_CHECK_VALIDATION_ERROR,
      { invalidFields: fields },
    );
  }
  return parsed.data;
}

export function assertActivityResult<T>(
  raw: unknown,
  schema: ActivityResultSchema<T>,
): asserts raw is T {
  parseActivityResult(raw, schema);
}
