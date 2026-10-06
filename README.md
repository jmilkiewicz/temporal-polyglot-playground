# temporal-polyglot-playground

What happens when a Temporal workflow written in TypeScript trusts the TypeScript type of an
activity that is really implemented in another language (here, Python), and what Zod validation
does about it.

The short version: a contract shaped as a record (`Record<SnackFlavor, boolean>`) cannot be fully
validated, because Zod 3 accepts an incomplete record and Zod 4 rejects it. A contract shaped as an
array (`SnackFlavor[]`) validates the same way in both.

No Python is involved. The tests register TypeScript functions that return the payloads a Python
activity would produce, forced past the type checker with `as unknown as` (see
`src/snack/activities.ts`). They run as real activities, so every payload goes through Temporal's
JSON payload converter, and that is where `undefined` disappears.

- `src/snack/`: the naive contract (`snackWorkflow`) and the same logic behind Zod validation
  (`snackWorkflowWithValidationZodV3`, `snackWorkflowWithValidationZodV4`)
- `src/snack/v2/`: the array contract (`snackWorkflowV2`, `snackWorkflowV2ZodV4`)
- `src/test-utils/snackTestEnv.ts`: the shared test setup, excluded from the build

Uses the Temporal TypeScript SDK (`@temporalio/*` **1.24.0**) and `zod` **3.25.76**, both pinned.
That `zod` release is the bridge release that ships Zod 3 at `"zod"` and Zod 4 at `"zod/v4"` in the
same package.

## Running the tests (no Docker)

Requires Node.js >= 20.3.

```sh
npm install
npm test
```

The tests use `TestWorkflowEnvironment.createTimeSkipping()` from `@temporalio/testing`. They need
neither Docker nor an external Temporal server. On the first run the SDK downloads the Time
Skipping Test Server binary and caches it in `$TMPDIR`, so that first run needs network access.

Jest (+ `ts-jest`) is used because it is the test runner the
[Temporal docs](https://docs.temporal.io/develop/typescript/testing-suite) officially support.
`ts-jest` 29.4 requires TypeScript `<7`, which is why TypeScript is pinned to 6.0.3.

Code is formatted with Prettier: `npm run format` rewrites files, `npm run format:check` fails if
anything is not formatted.

## The naive contract (`snackWorkflow`)

`SnackCheckResult.flavors` is typed as `Record<SnackFlavor, boolean> | null`, and the workflow does:

```ts
function workflowLogic(snackCheckResult: SnackCheckResult) {
  const { flavors, caption } = snackCheckResult;
  if (flavors !== null) {
    return { isSweet: flavors.SWEET, caption };
  }
  return { isSweet: false, caption };
}

export async function snackWorkflow(args: SnackCheckArgs): Promise<SnackWorkflowResult> {
  const snackCheckResult = await checkSnack(args);
  return workflowLogic(snackCheckResult);
}
```

| Variant          | Payload sent by "Python"                                                        | Symptom                                                                                                                                                              |
| ---------------- | ------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `missingFlavors` | `{ caption: "a cookie" }` (Pydantic `model_dump(exclude_none=True)`)            | Workflow fails with `TypeError: Cannot read properties of undefined (reading 'SWEET')`. The exception points at the guard, not at the producer that dropped the key. |
| `missingSweet`   | `{ flavors: { SPICY: false, SALTY: true }, caption: "dried fish" }`             | No error. The result has no `isSweet` at all, so a caller branching on it treats the snack as not sweet.                                                             |
| `lowercaseKeys`  | `{ flavors: { sweet: true, salty: false, spicy: false }, caption: "a cookie" }` | No error. Same as above, although the payload says the cookie is sweet. No key matches, so the system consistently detects nothing.                                  |
| `unknownFlavor`  | `{ flavors: { SWEET: true, SALTY: false, SPICY: false, UMAMI: true }, ... }`    | No error, `isSweet: true`. The extra `UMAMI` key passes through unnoticed.                                                                                           |

Two details the tests make explicit:

- In `missingSweet` (being a case of partial record) and `lowercaseKeys`, `flavors.SWEET` is `undefined`, the workflow returns
  `{ isSweet: undefined }`, and the payload converter drops the key. The client receives
  `{ caption: "a cookie" }`, although the type says `isSweet: boolean`. A well-behaved producer
  (`explicitlySweet` in the tests) gets `isSweet: true` through the same workflow.
- A plain `TypeError` thrown from workflow code does not fail the workflow by default. It fails the
  workflow _task_, which Temporal retries forever, so in production `missingFlavors` shows up as a
  stuck workflow. The test worker sets `workflowFailureErrorTypes: { "*": ["TypeError"] }` so the
  test can observe the exception.

## A record contract cannot be fully validated (`snackWorkflowWithValidationZodV3`)

`snackWorkflowWithValidationZodV3` and `snackWorkflowWithValidationZodV4` run the same naive logic,
but first validate the activity result. Both schemas contain the same line,
`flavors: z.record(SnackFlavor, z.boolean()).nullable()`. `schema.v3.ts` imports it from `"zod"`,
`schema.v4.ts` from `"zod/v4"`.

For the incomplete record `{ flavors: { SPICY: false, SALTY: true }, caption: "dried fish" }`:

| Schema       | Result                                          |
| ------------ | ----------------------------------------------- |
| `"zod (v3)"` | **Accepted**. `isSweet` is lost, as without Zod |
| `"zod/v4"`   | Rejected                                        |

With an enum as the key, Zod 3 treats the record as partial and Zod 4 as exhaustive. So whether the
validation catches an incomplete record depends on the import path.

## An array contract validates the same way (`src/snack/v2/`)

```ts
export const SnackCheckResultV2 = z.object({
  flavors: z.array(SnackFlavor).nullable(),
  caption: z.string().nullable(),
});
```

The activity sends the list of flavors it found. There is no such thing as an incomplete list: a
flavor that is not listed is not present. `snackWorkflowV2` validates the payload, builds the full
`Record<SnackFlavor, boolean>` locally from `SNACK_FLAVORS`, and on a validation error throws a
non-retryable `ApplicationFailure` (type `SnackCheckResultValidationError`).
`snackWorkflowV2ZodV4` is the same workflow with the schema imported from `"zod/v4"`.

| Activity          | Payload                                | Result (both `"zod v3"` and `"zod/v4"`) |
| ----------------- | -------------------------------------- | --------------------------------------- |
| `sweetCandy`      | `{ flavors: ["SWEET"], ... }`          | `isSweet: true`                         |
| `spicyOnly`       | `{ flavors: ["SPICY"], ... }`          | `isSweet: false`                        |
| `lowercaseFlavor` | `{ flavors: ["sweet"], ... }`          | Rejected                                |
| `unknownFlavor`   | `{ flavors: ["SWEET", "UMAMI"], ... }` | Rejected                                |

`spicyOnly` is the array counterpart of the incomplete record above. Both Zod versions accept it,
and the answer is correct.
