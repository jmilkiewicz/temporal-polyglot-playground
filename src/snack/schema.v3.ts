import { z } from "zod";
import { SNACK_FLAVORS } from "./types";

const SnackFlavor = z.enum(SNACK_FLAVORS);

export const SnackCheckResultSchema = z.object({
  flavors: z.record(SnackFlavor, z.boolean()).nullable(),
  caption: z.string().nullable(),
});
