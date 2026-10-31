# Unbound

Each section opens with its goal in bold, lists the rules that reach it, and ends with a test you can check. The rules describe how the code is already written. When a rule and a neighbouring file disagree, mirror the file.

## Workflow

**Let the tools carry the mechanics, and fix what they report at its cause.**

- The global `turn-check` hook formats each changed file with `oxfmt` and runs `oxlint --type-aware --fix` at every turn end, then reports what is left. Write the logic and let it handle whitespace, quotes, import order and statement padding.
- Fix each lint finding in the code. A lint message ending in `(AGENTS.md)` names its fix in the message itself.
- Shared lint rules and the commitlint config come from `@marioparaschiv/oxc-config`; change a shared rule there. Repo rules live in `scripts/oxlint/` (`unbound/*`), each with a fixture test.
- `bun run typecheck` before calling work done. `bun run plugins:test` and `bun run plugins:validate` for plugin changes. `bun run loader:test` and `bun run loader:validate` for `packages/loader`, the native loaders, which build with Go outside the Bun workspaces.
- Commits are Conventional Commits, scoped to the package or app (`feat(client): …`, `fix(web): …`).

The test: `turn-check` reports clean and `bun run typecheck` passes.

## Load the skill for the task

**Read the matching skill before you write the code it covers.** Each one holds the rules and examples for one kind of work.

| When you are                                                                                                           | Load             |
| ---------------------------------------------------------------------------------------------------------------------- | ---------------- |
| Writing a component, hook or `.style.ts` in `packages/client/src`                                                      | `client-ui`      |
| Adding or moving client code, adding a domain, a store or a public API member, or editing `packages/client/src/metro/` | `client-domains` |
| Writing a class, or touching `addons/` or a `<kind>/manager.ts`                                                        | `addon-managers` |
| Proving a client change on Discord                                                                                     | `unbound-dev`    |
| Reading how Discord implements something                                                                               | `hermes`         |
| Changing `apps/web` pages, endpoints, submissions or auth                                                              | `verify-web`     |

`GLOSSARY.md` defines the domain words (Setting, Bucket, Addon, …). Use its terms in names, comments and messages. `DESIGN.md` documents the Discord design-system primitives the UI composes.

## Files and imports

**One file, one job, found by its name.**

- Name files in kebab-case after the one concept they hold: `toast-container.tsx`, `use-toast-state.ts`, `is-empty.ts`.
- Import across directories with `~/` (the package's `src/`) and siblings in the same folder with `./`.
- Import workspace packages by name, and `@unbound-app/utils` one file at a time: `@unbound-app/utils/noop`.
- Write type-only imports as `import type { … }`.
- Each `utils/src` file holds one function, declared by name and default-exported on the last line.

The test: a reader finds any symbol from its file name alone.

## Functions

**Small, total functions that read top to bottom.**

- Declare top-level functions with `function name()`. Keep arrows for inline callbacks, one-line factories and methods inside a config object.
- Put defaults in the signature (`function uuid(length: number = 30)`), or destructure an option bag with defaults at the top of the body.
- Guard first: bail-outs at the top, the happy path at the left margin.
- Return `T | undefined` from a lookup that can miss, and let the caller guard.
- Annotate return types on exported API functions; let inference type private helpers.
- Use `??` when `0`, `''` or `false` are valid values, and `||` when any falsy value should fall through.
- Coerce a returned flag test with `Boolean(x)`.
- Materialise iterables with spread: `[...map.values()]`.

The test: every function fits on a screen and reads as guards, then work, then return.

## Types

**Model the real shape, so values are assignable as they are.**

- Name every object shape as a `type` alias and compose with `&`.
- Constrain generics (`T extends object`, `T extends Addon`). Use `T`, `U` for the common case and `TProps`, `EventMap` when a second name would be ambiguous.
- Use `PropertyKey` for any key, `Record<K, V>` with a concrete `V` for object maps, and `Map` for runtime maps.
- Narrow with a type predicate (`value is T`). Give an `unknown` parameter or return a `// UNKNOWN: <reason>` comment.
- Parse `JSON.parse` and `.json()` output with a schema.

The test: the diff compiles with each value's real type, and every `as` names a single cast to a known shape.

## Errors and logging

**Degrade gracefully and leave a trail that names the thing that failed.**

- Get a scoped logger with `createLogger('Scope')` or `createLogger('Scope', 'SubScope')`; it prints `[Scope → SubScope]`.
- Word errors as `` `Failed to <verb> <thing> ${id}:` `` and pass the error object as the second argument.
- Wrap a fallible mutation in `try/catch`, log it, record it and continue. Throw for programmer errors and broken contracts.
- Leave `catch (error)` as the compiler's `unknown`. An empty catch body holds a comment saying why it is safe.

The test: every failure in the logs names its operation and id.

## Comments

**A comment states what the code cannot: a side effect, an external invariant, an ordering requirement, a performance reason.**

- Give each exported function a JSDoc block: a one-line `@description`, then `@template`, a `@param` per parameter and `@returns`. Put any extra detail in those tags.
- Keep each comment under 200 characters.
- Update the comments around any code you change.

The test: every comment carries a fact a reader could only learn from the comment.

## Symmetry

**Write paired operations as mirrors.** `enable`/`disable`, `load`/`unload`, `add`/`remove` and mount/leave animations match line for line; change one and change its twin the same way.

The test: a reviewer cannot tell which lines of a diff are new from style alone.
