---
name: client-ui
description: 'Rules for React Native UI in packages/client/src: components, hooks, JSX and .style.ts files. Use when adding or editing a client .tsx component, use-*.ts hook or style sheet.'
---

# Client UI

**Components render, hooks hold logic, styles read theme tokens.** Compose primitives from `DESIGN.md`; prove on device with `unbound-dev`.

## Placement

- `ui/<domain>/` per domain, plus shared `ui/components` and `ui/hooks`.
- `ui/` imports domains; domains reach `ui/` only via `builtin.ts(x)` (`client-domains`).
- Import each component from its own file.

## Components

**One component per file: `function Name()`, `export default Name;` last.**

- Destructure props in the signature with inline defaults; props type is a named `type`.
- Sub-components and helpers get sibling files (`toast-icon.tsx`, `./color`).
- Logic goes in a sibling `use-*.ts` hook.
- One `variant: 'primary' | 'secondary'` prop over several booleans.
- Derive values during render.
- Read stores through a selector: `ThemeStore((state) => state.applied)`.

Test: everything rendered comes from props, a hook, or a selector.

## Hooks

- One per `use-name.ts`, `useName` default-exported.
- `useState` infers from its initial value; type it only when that value is `null` or `undefined`.
- Subscribe in `useEffect(…, [])` with a named `handler`, returning `() => void Events.off('changed', handler)`.
- `useMemo` with explicit deps for derived collections.

## JSX and styles

- Conditionals: `cond ? <Thing /> : null`.
- Compose styles as arrays: `style={[styles.base, active ? styles.active : null]}`.
- `<component>.style.ts` default-exports `Discord.createStyles({ … })`, camelCase keys.
- Colours, shadows and fonts come from `Theme` and `Constants` in `~/metro/common`.

Test: style files hold only theme tokens and layout numbers.
