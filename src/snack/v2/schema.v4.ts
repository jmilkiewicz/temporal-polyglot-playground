import { z } from "zod/v4";
import { SNACK_FLAVORS } from "../types";

// "zod/v4" installs its English error messages as a module side effect. zod declares
// `"sideEffects": false`, so the webpack build of Temporal's workflow bundle drops that module,
// and inside a workflow every issue reads just "Invalid input". Configure the locale explicitly
// so messages match what the same schema produces in plain Node.
z.config(z.locales.en());

const SnackFlavor = z.enum(SNACK_FLAVORS);

export const SnackCheckResultV2 = z.object({
  flavors: z.array(SnackFlavor).nullable(),
  caption: z.string().nullable(),
});
export type SnackCheckResultV2 = z.infer<typeof SnackCheckResultV2>;
