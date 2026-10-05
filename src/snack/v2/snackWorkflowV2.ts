import { proxyActivities } from "@temporalio/workflow";
import type { SnackWorkflowResult } from "../snackWorkflow";
import { SNACK_FLAVORS, type SnackCheckArgs, type SnackFlavor } from "../types";
import { parseActivityResult, type ActivityResultSchema } from "../validation";
import type { SnackActivitiesV2 } from "./activities";
import { SnackCheckResultV2 as SchemaFromZod, type SnackCheckResultV2 } from "./schema.v3";
import { SnackCheckResultV2 as SchemaFromZodV4 } from "./schema.v4";

const { checkSnack } = proxyActivities<SnackActivitiesV2>({
  startToCloseTimeout: "1 minute",
});

export async function snackWorkflowV2(args: SnackCheckArgs): Promise<SnackWorkflowResult> {
  return checkSnackAndValidate(args, SchemaFromZod);
}

export async function snackWorkflowV2ZodV4(args: SnackCheckArgs): Promise<SnackWorkflowResult> {
  return checkSnackAndValidate(args, SchemaFromZodV4);
}

async function checkSnackAndValidate(
  args: SnackCheckArgs,
  schema: ActivityResultSchema<SnackCheckResultV2>,
): Promise<SnackWorkflowResult> {
  // The activity's declared return type is not trusted: the payload is validated at runtime.
  const raw: unknown = await checkSnack(args);
  const { flavors, caption } = parseActivityResult(raw, schema);
  if (flavors === null) {
    return { isSweet: false, caption };
  }

  const flavorRecord = Object.fromEntries(
    SNACK_FLAVORS.map((flavor) => [flavor, flavors.includes(flavor)]),
  ) as Record<SnackFlavor, boolean>;

  return { isSweet: flavorRecord.SWEET, caption };
}
