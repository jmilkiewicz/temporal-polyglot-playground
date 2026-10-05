import { ApplicationFailure, WorkflowFailedError } from "@temporalio/client";
import { setUpSnackTestEnv } from "../../test-utils/snackTestEnv";
import type { SnackWorkflowResult } from "../snackWorkflow";
import { pythonCheckSnackV2Variants, sweetCookie } from "./activities";
import { SNACK_CHECK_VALIDATION_ERROR } from "../validation";
import { snackWorkflowV2, snackWorkflowV2ZodV4 } from "./snackWorkflowV2";

type SnackWorkflowV2 = typeof snackWorkflowV2;

const zodFlavors: { zod: string; workflow: SnackWorkflowV2 }[] = [
  { zod: "zod/v3", workflow: snackWorkflowV2 },
  { zod: "zod/v4", workflow: snackWorkflowV2ZodV4 },
];

describe("snackWorkflowV2 against a simulated Python checkSnack", () => {
  const runSnackWorkflow = setUpSnackTestEnv(require.resolve("./snackWorkflowV2"));

  async function expectValidationFailure(run: Promise<SnackWorkflowResult>): Promise<void> {
    const error = await run.catch((err: unknown) => err);

    expect(error).toBeInstanceOf(WorkflowFailedError);
    const cause = (error as WorkflowFailedError).cause;
    expect(cause).toBeInstanceOf(ApplicationFailure);
    expect(cause).toMatchObject({ type: SNACK_CHECK_VALIDATION_ERROR });
  }

  describe.each(zodFlavors)('with the schema imported from "$zod"', ({ workflow }) => {
    it("finds a sweet cookie sweet", async () => {
      const result = await runSnackWorkflow(sweetCookie, workflow);

      expect(result).toEqual({ isSweet: true, caption: "a candy" });
    });

    it("rejects a result without flavors", async () => {
      await expectValidationFailure(runSnackWorkflow(pythonCheckSnackV2Variants.missingFlavors, workflow));
    });

    it("rejects flavors sent in the old record shape", async () => {
      await expectValidationFailure(runSnackWorkflow(pythonCheckSnackV2Variants.partialRecord, workflow));
    });

    it("rejects a lowercase flavor", async () => {
      await expectValidationFailure(runSnackWorkflow(pythonCheckSnackV2Variants.lowercaseKeys, workflow));
    });

    it("rejects an old record shape carrying an unknown flavor", async () => {
      await expectValidationFailure(runSnackWorkflow(pythonCheckSnackV2Variants.unknownFlavor, workflow));
    });

    it("rejects an unknown flavor in the array", async () => {
      await expectValidationFailure(runSnackWorkflow(pythonCheckSnackV2Variants.unknownFlavorInArray, workflow));
    });
  });
});
