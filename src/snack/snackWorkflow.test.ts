import { ApplicationFailure, WorkflowFailedError } from "@temporalio/client";
import { setUpSnackTestEnv } from "../test-utils/snackTestEnv";
import { explicitlySweet, pythonCheckSnackVariants } from "./activities";
import {
  snackWorkflow,
  snackWorkflowWithValidationZodV3,
  snackWorkflowWithValidationZodV4,
} from "./snackWorkflow";
import { SNACK_CHECK_VALIDATION_ERROR } from "./validation";

describe("snackWorkflow against a simulated Python checkSnack", () => {
  const runSnackWorkflow = setUpSnackTestEnv(require.resolve("./snackWorkflow"));

  it("crashes with a TypeError when reading an undefined property", async () => {
    const error = await runSnackWorkflow(
      pythonCheckSnackVariants.missingFlavors,
      snackWorkflow,
    ).catch((err: unknown) => err);

    expect(error).toBeInstanceOf(WorkflowFailedError);
    const cause = (error as WorkflowFailedError).cause;
    expect(cause).toBeInstanceOf(ApplicationFailure);
    expect(cause).toMatchObject({
      type: "TypeError",
      message: "Cannot read properties of undefined (reading 'SWEET')",
    });
  });

  it("loses isSweet when the SWEET key is missing", async () => {
    const partial = await runSnackWorkflow(pythonCheckSnackVariants.partialRecord, snackWorkflow);
    const lowerCased = await runSnackWorkflow(
      pythonCheckSnackVariants.lowercaseKeys,
      snackWorkflow,
    );
    const wellBehavedSweet = await runSnackWorkflow(explicitlySweet, snackWorkflow);

    expect(wellBehavedSweet.isSweet).toBe(true);
    expect(partial).not.toHaveProperty("isSweet");
    expect(lowerCased).not.toHaveProperty("isSweet");
  });

  it("reports a sweet snack correctly and silently ignores an extra flavor", async () => {
    const result = await runSnackWorkflow(pythonCheckSnackVariants.unknownFlavor, snackWorkflow);

    expect(result).toEqual({ isSweet: true, caption: "a cookie" });
  });

  it('still loses isSweet on a partial record validated with "zod/v3"', async () => {
    const partial = await runSnackWorkflow(
      pythonCheckSnackVariants.partialRecord,
      snackWorkflowWithValidationZodV3,
    );

    expect(partial).not.toHaveProperty("isSweet");
  });

  it('rejects a partial record validated with "zod/v4"', async () => {
    const error = await runSnackWorkflow(
      pythonCheckSnackVariants.partialRecord,
      snackWorkflowWithValidationZodV4,
    ).catch((err: unknown) => err);

    expect(error).toBeInstanceOf(WorkflowFailedError);
    const cause = (error as WorkflowFailedError).cause;
    expect(cause).toBeInstanceOf(ApplicationFailure);
    expect(cause).toMatchObject({
      type: SNACK_CHECK_VALIDATION_ERROR,
    });
  });
});
