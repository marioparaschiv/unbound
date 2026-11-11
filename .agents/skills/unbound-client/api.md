# Public API

**Public API is the named exports of `<domain>/api.ts`** (also `native/native.ts`, `native/fs.ts`, and `metro/index.ts`).

- Add the module to `core/api.ts`: `export * as toasts from '~/toasts/api'`.
- New modules: named exports only. The SDK drops `default`; an existing `default` object stays and gets each new member.
- Rename: rename in place and update every caller. Unbound is unreleased, so no `@deprecated` alias keeps the old name.
- Barrels hold only re-exports: `core/api.ts` and `metro/index.ts`. Everything else imports its file.

Test: the namespace is in `core/api.ts`.
