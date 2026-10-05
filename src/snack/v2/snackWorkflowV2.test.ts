import { ApplicationFailure, WorkflowFailedError } from "@temporalio/client";
import { TestWorkflowEnvironment } from "@temporalio/testing";
import { randomUUID } from "node:crypto";
import { bundleWorkflowCode, Worker, type WorkflowBundleWithSourceMap } from "@temporalio/worker";
import type { SnackWorkflowResult } from "../snackWorkflow";
import { pythonCheckSnackV2Variants, sweetCookie, type SnackActivitiesV2 } from "./activities";
import { SNACK_CHECK_VALIDATION_ERROR } from "../validation";
import { snackWorkflowV2, snackWorkflowV2ZodV4 } from "./snackWorkflowV2";

type SnackWorkflowV2 = typeof snackWorkflowV2;

const zodFlavors: { zod: string; workflow: SnackWorkflowV2 }[] = [
  { zod: "zod/v3", workflow: snackWorkflowV2 },
  { zod: "zod/v4", workflow: snackWorkflowV2ZodV4 },
];

describe("snackWorkflowV2 against a simulated Python checkSnack", () => {
  let testEnv: TestWorkflowEnvironment;
  let workflowBundle: WorkflowBundleWithSourceMap;

  beforeAll(async () => {
    testEnv = await TestWorkflowEnvironment.createTimeSkipping();
    workflowBundle = await bundleWorkflowCode({
      workflowsPath: require.resolve("./snackWorkflowV2"),
    });
  });

  afterAll(async () => {
    await testEnv?.teardown();
  });

  // Each run gets its own worker and task queue, so that each one registers a different
  // implementation under the same activity name, `checkSnack`.
  async function runSnackWorkflow(
    checkSnack: SnackActivitiesV2["checkSnack"],
    workflow: SnackWorkflowV2,
  ): Promise<SnackWorkflowResult> {
    const taskQueue = `snack-v2-${randomUUID()}`;
    const worker = await Worker.create({
      connection: testEnv.nativeConnection,
      taskQueue,
      workflowBundle,
      activities: { checkSnack },
    });
    return worker.runUntil(
      testEnv.client.workflow.execute(workflow, {
        args: [{ photoUrl: "https://example.com/snack.jpg", checkFlavors: true }],
        taskQueue,
        workflowId: taskQueue,
      }),
    );
  }

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
