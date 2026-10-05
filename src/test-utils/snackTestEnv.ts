import { TestWorkflowEnvironment } from "@temporalio/testing";
import { bundleWorkflowCode, Worker, type WorkflowBundleWithSourceMap } from "@temporalio/worker";
import { randomUUID } from "node:crypto";
import type { SnackWorkflowResult } from "../snack/snackWorkflow";
import type { SnackCheckArgs } from "../snack/types";

type CheckSnack = (args: SnackCheckArgs) => Promise<unknown>;
export type SnackWorkflow = (args: SnackCheckArgs) => Promise<SnackWorkflowResult>;

// Registers beforeAll/afterAll for a time-skipping test environment and returns a function that
// runs one snack workflow against the given checkSnack implementation.
export function setUpSnackTestEnv(workflowsPath: string) {
  let testEnv: TestWorkflowEnvironment;
  let workflowBundle: WorkflowBundleWithSourceMap;

  beforeAll(async () => {
    testEnv = await TestWorkflowEnvironment.createTimeSkipping();
    workflowBundle = await bundleWorkflowCode({ workflowsPath });
  });

  afterAll(async () => {
    await testEnv?.teardown();
  });

  return async function runSnackWorkflow(
    checkSnack: CheckSnack,
    workflow: SnackWorkflow,
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
  };
}
