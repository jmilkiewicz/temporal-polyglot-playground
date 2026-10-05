import { ApplicationFailure, WorkflowFailedError } from "@temporalio/client";
import { TestWorkflowEnvironment } from "@temporalio/testing";
import { randomUUID } from "node:crypto";
import { bundleWorkflowCode, Worker, type WorkflowBundleWithSourceMap } from "@temporalio/worker";
import { explicitlySweet, pythonCheckSnackVariants, type SnackActivities } from "./activities";
import {
  snackWorkflow,
  snackWorkflowWithValidationZodV3,
  snackWorkflowWithValidationZodV4,
  type SnackWorkflowResult,
} from "./snackWorkflow";
import { SNACK_CHECK_VALIDATION_ERROR } from "./validation";

describe("snackWorkflow against a simulated Python checkSnack", () => {
  let testEnv: TestWorkflowEnvironment;
  let workflowBundle: WorkflowBundleWithSourceMap;

  beforeAll(async () => {
    testEnv = await TestWorkflowEnvironment.createTimeSkipping();
    workflowBundle = await bundleWorkflowCode({
      workflowsPath: require.resolve("./snackWorkflow"),
    });
  });

  afterAll(async () => {
    await testEnv?.teardown();
  });

  async function runSnackWorkflow(
    checkSnack: SnackActivities["checkSnack"],
    workflow: typeof snackWorkflow = snackWorkflow,
  ): Promise<SnackWorkflowResult> {
    const taskQueue = `snack-${randomUUID()}`;
    const worker = await Worker.create({
      connection: testEnv.nativeConnection,
      taskQueue,
      workflowBundle,
      activities: { checkSnack },
      // By default a plain Error thrown from workflow code fails the workflow *task*, and the
      // task is retried forever: the workflow just hangs. Promote TypeError to a workflow
      // failure so the test can observe the exception instead of timing out.
      workflowFailureErrorTypes: { "*": ["TypeError"] },
    });
    return worker.runUntil(
      testEnv.client.workflow.execute(workflow, {
        args: [{ photoUrl: "https://example.com/snack.jpg", checkFlavors: true }],
        taskQueue,
        workflowId: taskQueue,
      }),
    );
  }

    it("crashes with a TypeError when reading an undefined property", async () => {
    const error = await runSnackWorkflow(pythonCheckSnackVariants.missingFlavors).catch(
      (err: unknown) => err,
    );

    expect(error).toBeInstanceOf(WorkflowFailedError);
    const cause = (error as WorkflowFailedError).cause;
    expect(cause).toBeInstanceOf(ApplicationFailure);
    expect(cause).toMatchObject({
      type: "TypeError",
      message: "Cannot read properties of undefined (reading 'SWEET')",
    });
  });

  it("loses isSweet when the SWEET key is missing", async () => {
    const partial = await runSnackWorkflow(pythonCheckSnackVariants.partialRecord);
    const lowerCased = await runSnackWorkflow(pythonCheckSnackVariants.lowercaseKeys);
    const wellBehavedSweet = await runSnackWorkflow(explicitlySweet);

    expect(wellBehavedSweet.isSweet).toBe(true);
    expect(partial).not.toHaveProperty("isSweet");
    expect(lowerCased).not.toHaveProperty("isSweet");
  });

  it("reports a sweet snack correctly and silently ignores an extra flavor", async () => {
    const result = await runSnackWorkflow(pythonCheckSnackVariants.unknownFlavor);

    expect(result).toEqual({ isSweet: true, caption: "a cookie" });
  });

  it('still loses isSweet on a partial record validated with "zod v3"', async () => {
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
