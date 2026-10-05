import type { SnackCheckArgs } from "../types";
import type { SnackCheckResultV2 } from "./schema.v3";

export interface SnackActivitiesV2 {
  checkSnack(args: SnackCheckArgs): Promise<SnackCheckResultV2>;
}

type CheckSnackV2 = SnackActivitiesV2["checkSnack"];

// A well-behaved implementation of the V2 contract. Used as the happy path.
export const sweetCookie: CheckSnackV2 = async () => ({
  flavors: ["SWEET"],
  caption: "a candy",
});

// Each variant below SIMULATES a checkSnack activity written in Python with a different SDK,
// the same broken payloads as in ../activities.ts, translated to the array shape where that
// makes sense. The `as unknown as SnackCheckResultV2` cast stands in for the language boundary.
// The payloads still go through Temporal's JSON payload converter before the workflow sees them.
export const pythonCheckSnackV2Variants = {
  // Python: model_dump(exclude_none=True) drops `flavors` entirely when it is None.
  // Simulated second SDK: the cast hides the missing key.
  missingFlavors: async () => ({ caption: "a cookie" }) as unknown as SnackCheckResultV2,

  // Python: still on the old record contract. A partial array would simply be valid in V2, so
  // the meaningful failure here is the producer sending the V1 shape.
  // Simulated second SDK: the cast hides the record where an array is expected.
  partialRecord: async () =>
    ({ flavors: { SPICY: false }, caption: "a cookie" }) as unknown as SnackCheckResultV2,

  // Python: an enum serialised by `.value` with lowercase values.
  // Simulated second SDK: the cast hides that "sweet" is not a SnackFlavor.
  lowercaseKeys: async () =>
    ({ flavors: ["sweet"], caption: "a cookie" }) as unknown as SnackCheckResultV2,

  // Python: still on the old record contract, with an extra UMAMI key.
  // Simulated second SDK: the cast hides the record where an array is expected.
  unknownFlavor: async () =>
    ({
      flavors: { SWEET: true, SALTY: false, SPICY: false, UMAMI: true },
      caption: "a cookie",
    }) as unknown as SnackCheckResultV2,

  // Python: the enum gained a member that the TypeScript side has never heard of.
  // Simulated second SDK: the cast hides that "UMAMI" is not a SnackFlavor.
  unknownFlavorInArray: async () =>
    ({ flavors: ["SWEET", "UMAMI"], caption: "a cookie" }) as unknown as SnackCheckResultV2,
} satisfies Record<string, CheckSnackV2>;
