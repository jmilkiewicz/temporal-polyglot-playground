import { ApplicationFailure, WorkflowFailedError } from "@temporalio/client";
import { setUpSnackTestEnv, type SnackWorkflow } from "../../test-utils/snackTestEnv";
import type { SnackWorkflowResult } from "../snackWorkflow";
import { pythonCheckSnackV2Variants, spicyOnly, sweetCandy } from "./activities";
import { SNACK_CHECK_VALIDATION_ERROR } from "../validation";
import { snackWorkflowV2, snackWorkflowV2ZodV4 } from "./snackWorkflowV2";

const zodFlavors: { zod: string; workflow: SnackWorkflow }[] = [
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
    it("finds a sweet candy sweet", async () => {
      const result = await runSnackWorkflow(sweetCandy, workflow);

      expect(result).toEqual({ isSweet: true, caption: "a candy" });
    });

    it("reports a snack without SWEET as not sweet", async () => {
      const result = await runSnackWorkflow(spicyOnly, workflow);

      expect(result).toEqual({ isSweet: false, caption: "a chili" });
    });

    it("rejects a lowercase flavor", async () => {
      await expectValidationFailure(
        runSnackWorkflow(pythonCheckSnackV2Variants.lowercaseFlavor, workflow),
      );
    });

    it("rejects an unknown flavor in the array", async () => {
      await expectValidationFailure(
        runSnackWorkflow(pythonCheckSnackV2Variants.unknownFlavor, workflow),
      );
    });
  });
});
