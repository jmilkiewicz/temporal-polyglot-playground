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

export const pythonCheckSnackV2Variants = {
  // Python: an enum serialised by `.value` with lowercase values.
  lowercaseFlavor: async () =>
    ({ flavors: ["sweet"], caption: "a cookie" }) as unknown as SnackCheckResultV2,

  // Python: the enum gained a member that the TypeScript side has never heard of.
  unknownFlavorInArray: async () =>
    ({ flavors: ["SWEET", "UMAMI"], caption: "a cookie" }) as unknown as SnackCheckResultV2,
} satisfies Record<string, CheckSnackV2>;
