import { proxyActivities } from "@temporalio/workflow";
import type { SnackActivities } from "./activities";
import { SnackCheckResultSchema as SchemaFromZod } from "./schema.v3";
import { SnackCheckResultSchema as SchemaFromZodV4 } from "./schema.v4";
import type {SnackCheckArgs, SnackCheckResult} from "./types";
import { parseActivityResult } from "./validation";

export interface SnackWorkflowResult {
  isSweet: boolean;
  caption: string | null;
}

const { checkSnack } = proxyActivities<SnackActivities>({
  startToCloseTimeout: "1 minute",
});

function workflowLogic(snackCheckResult:SnackCheckResult) {

  const {flavors, caption} = snackCheckResult;
  if (flavors !== null) {
    return {isSweet: flavors.SWEET, caption};
  }
  return {isSweet: false, caption};
}

export async function snackWorkflow(args: SnackCheckArgs): Promise<SnackWorkflowResult> {
  // Deliberately naive: trusts the TypeScript type of the activity result completely.
  const snackCheckResult = await checkSnack(args);
  return workflowLogic(snackCheckResult);
}

export async function snackWorkflowWithValidationZodV3(args: SnackCheckArgs): Promise<SnackWorkflowResult> {
  const result = await checkSnack(args);
  parseActivityResult(result, SchemaFromZod);
  return workflowLogic(result);
}

export async function snackWorkflowWithValidationZodV4(args: SnackCheckArgs): Promise<SnackWorkflowResult> {
  const result = await checkSnack(args);
  parseActivityResult(result, SchemaFromZodV4);
  return workflowLogic(result);
}
