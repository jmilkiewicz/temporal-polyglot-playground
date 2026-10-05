import { z } from "zod/v4";
import { SNACK_FLAVORS } from "./types";

// See v2/schema.v4.ts: without this, Zod 4 messages inside the workflow bundle read just
// "Invalid input".
z.config(z.locales.en());

const SnackFlavor = z.enum(SNACK_FLAVORS);

export const SnackCheckResultSchema = z.object({
  flavors: z.record(SnackFlavor, z.boolean()).nullable(),
  caption: z.string().nullable(),
});
