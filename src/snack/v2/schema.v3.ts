import { z } from "zod";
import { SNACK_FLAVORS } from "../types";

const SnackFlavor = z.enum(SNACK_FLAVORS);

export const SnackCheckResultV2 = z.object({
  flavors: z.array(SnackFlavor).nullable(),
  caption: z.string().nullable(),
});
export type SnackCheckResultV2 = z.infer<typeof SnackCheckResultV2>;
