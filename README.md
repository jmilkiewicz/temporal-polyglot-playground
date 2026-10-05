# temporal-playground

Minimal "hello world" using the Temporal TypeScript SDK (`@temporalio/*` **1.24.0**, pinned).

- `src/activities.ts`: the `greet(name)` activity
- `src/greetWorkflow.ts`: the `greetWorkflow(name)` workflow, which calls `greet`
- `src/worker.ts`: a worker that registers the workflow and the activity
- `src/client.ts`: a CLI client that starts the workflow
- `src/greetWorkflow.test.ts`: end-to-end tests on `TestWorkflowEnvironment.createTimeSkipping()`

Requires Node.js >= 20.3.

```sh
npm install
```

## Tests (no Docker)

```sh
npm test
```

The tests use `TestWorkflowEnvironment.createTimeSkipping()` from `@temporalio/testing`. They need
neither Docker nor an external Temporal server. On the first run the SDK downloads the Time
Skipping Test Server binary and caches it in `$TMPDIR`, so that first run needs network access.

On Apple Silicon the SDK downloads a native arm64 binary, so Rosetta is not needed. The comment
in the SDK typings that says otherwise is outdated.

### Why Jest rather than Vitest

Jest (+ `ts-jest`) is the only one of the two that the
[Temporal docs](https://docs.temporal.io/develop/typescript/testing-suite) officially support. They
list its requirements (Jest >= 27, `testEnvironment: "node"`) and base their `beforeAll` and
`afterAll` examples on it. Vitest is not mentioned in the docs. It would probably work, but nothing
on the SDK side guarantees it.

Note: `ts-jest` 29.4 requires TypeScript `<7`, which is why TypeScript is pinned to 6.0.3.

## Running manually against a server (docker-compose)

This is a separate path. `npm test` does not use it. The worker and client run straight from
TypeScript via `tsx`; `npm run build` (tsc to `lib/`) is only needed for a compiled build.

```sh
npm run server:up              # docker compose up -d: Temporal server + Web UI
npm run start:worker           # terminal 1
npm run start:client -- Alice  # terminal 2, prints "Hello, Alice!"
npm run server:down
```

Web UI: <http://localhost:8080>. You will find the started `greet-<uuid>` workflow in the `default`
namespace. The gRPC server listens on `localhost:7233`. Set `TEMPORAL_ADDRESS` to use a different
address.

## Cross-language contract drift (`src/snack/`)

A second, independent example: what happens when a TypeScript workflow trusts the TypeScript type
of an activity that is really implemented in another language (here, Python). No Python is
involved. The worker registers TypeScript functions that return the payloads a Python activity
would produce, forced past the type checker with `as unknown as` (see `src/snack/activities.ts`).
They run as real activities, so every payload goes through Temporal's JSON payload converter, and
that is where `undefined` disappears.

Depends on `zod` pinned to **3.25.76**, the bridge release that ships Zod 3 at `"zod"` and Zod 4
at `"zod/v4"` in the same package.

### The naive contract (`snackWorkflow`)

`SnackCheckResult.flavors` is typed as `Record<SnackFlavor, boolean> | null`, and the workflow does:

```ts
const { flavors, caption } = await checkSnack(args);
if (flavors !== null) {
  return { isSweet: flavors.SWEET, caption };
}
return { isSweet: false, caption };
```

| Variant         | Payload sent by "Python"                                                      | Symptom                                                                                                                                                                  |
| --------------- | ----------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `missingFlavors` | `{ caption: "a cookie" }` (Pydantic `model_dump(exclude_none=True)`)          | Workflow fails with `TypeError: Cannot read properties of undefined (reading 'SWEET')`. The exception points at the guard, not at the producer that dropped the key. |
| `partialRecord`  | `{ flavors: { SPICY: false }, caption: "a cookie" }`                          | No error. The result has no `isSweet` at all, so a caller branching on it treats the snack as not sweet.                                                           |
| `lowercaseKeys`  | `{ flavors: { sweet: true, salty: false, spicy: false }, caption: "a cookie" }` | No error. Same as above, although the payload says the cookie is sweet. No key matches, so the system consistently detects nothing.                              |
| `unknownFlavor`  | `{ flavors: { SWEET: true, SALTY: false, SPICY: false, UMAMI: true }, ... }`  | No error, `isSweet: true`. The extra `UMAMI` key passes through unnoticed.                                                                                         |

Two details the tests make explicit:

- In `partialRecord` and `lowercaseKeys`, `flavors.SWEET` is `undefined`, the workflow returns
  `{ isSweet: undefined }`, and the payload converter drops the key. The client receives
  `{ caption: "a cookie" }`, although the type says `isSweet: boolean`. A well-behaved producer
  (`explicitlySweet` in the tests) gets `isSweet: true` through the same workflow.
- A plain `TypeError` thrown from workflow code does not fail the workflow by default. It fails the
  workflow *task*, which Temporal retries forever, so in production `missingFlavors` shows up as a
  stuck workflow. The test worker sets `workflowFailureErrorTypes: { "*": ["TypeError"] }` so the
  test can observe the exception.

### Adding Zod validation does not fix it (`snackWorkflowWithValidation`)

`snackWorkflowWithValidation` and `snackWorkflowWithValidationZodV4` run the same naive logic, but
first validate the activity result against a schema with the same line in both versions:
`flavors: z.record(SnackFlavor, z.boolean()).nullable()`. `schema.v3.ts` imports it from `"zod"`,
`schema.v4.ts` from `"zod/v4"`.

| Variant          | `"zod"`                                   | `"zod/v4"`             |
| ---------------- | ----------------------------------------- | ---------------------- |
| `missingFlavors` | Rejected                                  | Rejected               |
| `partialRecord`  | **Accepted**, `isSweet` is still lost     | Rejected               |
| `lowercaseKeys`  | Rejected                                  | Rejected               |
| `unknownFlavor`  | Rejected                                  | Rejected               |

With an enum as the key, Zod 3 treats the record as partial and Zod 4 as exhaustive. So the
incomplete object, the case the validation was supposed to catch, passes in Zod 3. Zod 3's
inferred type even says so (`SWEET: boolean | undefined`), but nothing makes the workflow look at
it. The tests cover the `partialRecord` row.

### The fixed contract (`src/snack/v2/`)

```ts
export const SnackCheckResultV2 = z.object({
  flavors: z.array(SnackFlavor).nullable(),
  caption: z.string().nullable(),
});
```

The activity sends the list of flavors it found. `snackWorkflowV2` validates the payload at
runtime, builds the full `Record<SnackFlavor, boolean>` locally from `SNACK_FLAVORS`, and on a
validation error throws a non-retryable `ApplicationFailure` (type
`SnackCheckResultValidationError`), so the workflow fails instead of retrying the task forever.
`snackWorkflowV2ZodV4` is the same workflow with the schema imported from `"zod/v4"`.

| Variant                | Payload sent by "Python"                                  | Symptom (both `"zod"` and `"zod/v4"`)              |
| ---------------------- | --------------------------------------------------------- | ------------------------------------------------- |
| `missingFlavors`         | `{ caption: "a cookie" }`                                 | Workflow fails on validation at `flavors`          |
| `partialRecord`        | `{ flavors: { SPICY: false }, ... }` (old record shape)   | Workflow fails on validation at `flavors`          |
| `lowercaseKeys`        | `{ flavors: ["sweet"], ... }`                             | Workflow fails on validation at `flavors.0`        |
| `unknownFlavor`        | `{ flavors: { SWEET: true, ..., UMAMI: true }, ... }`     | Workflow fails on validation at `flavors`          |
| `unknownFlavorInArray` | `{ flavors: ["SWEET", "UMAMI"], ... }`                    | Workflow fails on validation at `flavors.1`        |

`z.array` gives the same verdict at the same path under both import paths. Only
the wording of the messages differs between Zod 3 and Zod 4. The tests only check that the
workflow fails with `SnackCheckResultValidationError`, not the wording.

One more trap shows up here. `"zod/v4"` installs its English messages as a module side effect, and
zod declares `"sideEffects": false`. The webpack build of Temporal's workflow bundle therefore
drops that module, and inside a workflow every Zod 4 issue reads just `"Invalid input"`.
`v2/schema.v4.ts` calls `z.config(z.locales.en())` explicitly to get the full messages back.
