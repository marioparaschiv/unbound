# Unbound

Rules describe the code as written. When a rule and a neighbouring file disagree, mirror the file.

## Workflow

**Let the tools handle mechanics; fix what they report at the cause.**

- `turn-check` formats and lint-fixes changed files each turn. A lint message ending `(AGENTS.md)` states its own fix.
- Shared lint rules and commitlint come from `@marioparaschiv/oxc-config`; repo rules live in `scripts/oxlint/` with fixture tests.
- Run `bun run typecheck` before finishing. Plugins: `bun run plugins:test`, `plugins:validate`. Native loaders (`packages/loader`, Go): `bun run loader:test`, `loader:validate`.
- Commit as `type(scope): subject`, scope = package or app.

Test: `turn-check` is clean and `bun run typecheck` passes.

## Skills

**Load the skill before writing the code it covers.**

| Task                                                   | Skill            |
| ------------------------------------------------------ | ---------------- |
| Client component, hook or `.style.ts`                  | `client-ui`      |
| Client domain, store, public API, builtin, or `metro/` | `client-domains` |
| A class, `addons/`, or a `<kind>/manager.ts`           | `addon-managers` |
| Proving a client change on Discord                     | `unbound-dev`    |
| How Discord implements something                       | `hermes`         |
| `apps/web` pages, endpoints or auth                    | `verify-web`     |

Name things with `GLOSSARY.md` terms. `DESIGN.md` lists the design-system primitives.

## Files

**One concept per file, findable by name.**

- kebab-case names: `use-toast-state.ts`.
- `~/` across directories, `./` for siblings.
- Import `@unbound-app/utils` per file: `@unbound-app/utils/noop`.
- `import type` for type-only imports.

## Functions

**Small, total, top to bottom: guards, work, return.**

- `function name()` at top level; arrows for callbacks and one-line factories.
- Defaults in the signature, or one option-bag destructure at the top.
- Lookups return `T | undefined`; the caller guards.
- Annotate return types on exported functions only.
- `??` when `0`, `''` or `false` are valid; `||` otherwise.
- `Boolean(x)` to return a flag test; `[...map.values()]` to materialise.

## Types

**Model the real shape so values assign without casts.**

- `type` aliases, composed with `&`.
- Constrain generics: `T extends Addon`.
- `PropertyKey` for keys; `Record<K, V>` with a concrete `V`; `Map` at runtime.
- Narrow with `value is T`. Mark a needed `unknown` with `// UNKNOWN: <reason>`.
- Parse `JSON.parse` and `.json()` output with a schema.

## Errors

**Degrade gracefully; name what failed.**

- Logger: `createLogger('Scope', 'SubScope')`.
- Message: `` `Failed to <verb> <thing> ${id}:` ``, error as the second argument.
- Fallible mutation: `try/catch`, log, record, continue. Throw only for programmer errors.
- An empty `catch` holds a comment saying why.

Test: every logged failure names its operation and id.

## Comments

**Say only what the code cannot: side effects, invariants, ordering, performance.**

- Exported functions get JSDoc: one-line `@description`, then `@template`, `@param`, `@returns`.
- Under 200 characters each. Update comments next to code you change.

## Symmetry

**Paired operations mirror line for line** (`enable`/`disable`, `load`/`unload`). Change both together.

Test: a reviewer cannot tell new lines from old by style.
