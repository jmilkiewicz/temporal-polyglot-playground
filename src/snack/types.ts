import { z } from "zod";

export const SNACK_FLAVORS = ["SWEET", "SALTY", "SPICY"] as const;
export const SnackFlavor = z.enum(SNACK_FLAVORS);
export type SnackFlavor = z.infer<typeof SnackFlavor>;

export interface SnackCheckArgs {
  photoUrl: string;
  checkFlavors: boolean;
}

// The naive version, the one this demo sets out to break
export interface SnackCheckResult {
  flavors: Record<SnackFlavor, boolean> | null; // null = flavors were not checked
  caption: string | null;
}
