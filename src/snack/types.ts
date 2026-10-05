export const SNACK_FLAVORS = ["SWEET", "SALTY", "SPICY"] as const;
export type SnackFlavor = (typeof SNACK_FLAVORS)[number];

export interface SnackCheckArgs {
  photoUrl: string;
  checkFlavors: boolean;
}

// The naive version, the one this demo sets out to break
export interface SnackCheckResult {
  flavors: Record<SnackFlavor, boolean> | null; // null = flavors were not checked
  caption: string | null;
}
