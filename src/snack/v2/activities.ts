import type { SnackCheckArgs } from "../types";
import type { SnackCheckResultV2 } from "./schema.v3";

export interface SnackActivitiesV2 {
  checkSnack(args: SnackCheckArgs): Promise<SnackCheckResultV2>;
}

type CheckSnackV2 = SnackActivitiesV2["checkSnack"];

// Well-behaved implementations of the V2 contract.
export const sweetCandy: CheckSnackV2 = async () => ({
  flavors: ["SWEET"],
  caption: "a candy",
});

export const spicyOnly: CheckSnackV2 = async () => ({
  flavors: ["SPICY"],
  caption: "a chili",
});

// Each variant below SIMULATES a checkSnack activity written in Python with a different SDK.
// The TypeScript types do not describe what Python actually sends, so every payload is forced
// through `as unknown as SnackCheckResultV2`. That cast stands in for the language boundary. The
// worker still runs them as real activities, so each payload goes through Temporal's JSON payload
// converter on its way to the workflow.
export const pythonCheckSnackV2Variants = {
  // Python: an enum serialised by `.value` with lowercase values.
  lowercaseFlavor: async () =>
    ({ flavors: ["sweet"], caption: "a cookie" }) as unknown as SnackCheckResultV2,

  // Python: the enum gained a member that the TypeScript side has never heard of.
  unknownFlavor: async () =>
    ({ flavors: ["SWEET", "UMAMI"], caption: "a cookie" }) as unknown as SnackCheckResultV2,
} satisfies Record<string, CheckSnackV2>;
