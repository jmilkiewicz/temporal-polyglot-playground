import type { SnackCheckArgs, SnackCheckResult } from "./types";

export interface SnackActivities {
  checkSnack(args: SnackCheckArgs): Promise<SnackCheckResult>;
}

type CheckSnack = SnackActivities["checkSnack"];

// A well-behaved implementation that honours the TypeScript contract. Used as the control case.
export const explicitlySweet: CheckSnack = async () => ({
  flavors: { SWEET: true, SALTY: false, SPICY: false },
  caption: "a chocolate",
});

// Each variant below SIMULATES a checkSnack activity written in Python with a different SDK.
// The TypeScript types do not describe what Python actually sends, so every payload is forced
// through `as unknown as SnackCheckResult`. That cast stands in for the language boundary: in
// production nothing would check these shapes either. The worker still runs them as real
// activities, so each payload goes through Temporal's JSON payload converter on its way to the
// workflow.
export const pythonCheckSnackVariants = {
  // Python: model_dump(exclude_none=True) drops `flavors` entirely when it is None.
  missingFlavors: async () => ({ caption: "no idea" }) as unknown as SnackCheckResult,

  // Python: a dict that only contains the flavors the model actually looked at.
  missingSweet: async () =>
    ({ flavors: { SPICY: false, SALTY: true }, caption: "dried fish" }) as unknown as SnackCheckResult,

  // Python: an enum serialised by `.value` with lowercase values.
  lowercaseKeys: async () =>
    ({
      flavors: { sweet: true, salty: false, spicy: false },
      caption: "a cookie",
    }) as unknown as SnackCheckResult,

  // Python: the enum gained a member that the TypeScript side has never heard of.
  withUnknownFlavor: async () =>
    ({
      flavors: { SWEET: true, SALTY: true, SPICY: true, UMAMI: true },
      caption: "iberico",
    }) as unknown as SnackCheckResult,
} satisfies Record<string, CheckSnack>;
