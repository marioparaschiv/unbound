---
name: client-ui
description: 'Rules for writing React Native UI in packages/client/src: components, hooks, JSX and .style.ts files. Use when adding or editing a .tsx component, a use-*.ts hook, or a style sheet in the Unbound client.'
---

# Client UI

**Component files render; hooks hold the logic; styles read theme tokens.** `DESIGN.md` at the repo root documents the Discord design-system primitives to compose. Prove the result on device with the `unbound-dev` skill.

## Where it goes

- Components live in `ui/`, one subfolder per domain (`ui/addons`, `ui/settings`, `ui/toasts`) plus shared `ui/components` and `ui/hooks`.
- `ui/` imports domains. A domain reaches `ui/` only through its `builtin.ts(x)`; the `client-domains` skill has the layer table.
- Import each component from its own file: `import ToastIcon from './toast-icon'`, `import Page from '~/ui/components/page'`.

The test: `unbound/no-upward-imports` and `import/no-cycle` pass.

## Components

**One component per file, declared by name, default-exported on the last line.**

```tsx
type TintedIconProps = { source: number; size?: number };

function TintedIcon({ source, size = 24 }: TintedIconProps) {
	/* … */
}

export default TintedIcon;
```

- Destructure props in the signature, with defaults inline and the props shape as a named `type`.
- Give a sub-component its own sibling file (`toast-icon.tsx` beside `toast.tsx`) and a plain helper its own module (`./color`).
- Move logic into a sibling `use-*.ts` hook: `toast.tsx` ↔ `use-toast-state.ts`.
- Model a choice as one `variant: 'primary' | 'secondary'` prop, so options stay mutually exclusive.
- Derive values from props and state during render.
- Subscribe to a store with a selector for the slice you read: `useToastStore((state) => state.toasts)`.

The test: the file renders one component, and every value it shows comes from props, a hook, or a store selector.

## Hooks

- One hook per `use-name.ts`, `useName` default-exported.
- Let `useState` infer from its initial value; add a type argument when the initial value is `null` or `undefined` and the real type is wider.
- Subscribe in `useEffect` with `[]`: declare a named `function handler()` inside and return the cleanup, `return () => void Events.off('changed', handler);`.
- Memoise derived collections with `useMemo` and an explicit dependency array.

## JSX and styles

- Render a conditional as `condition ? <Thing /> : null`.
- Compose styles as an array: `style={[styles.base, active ? styles.active : null, { opacity }]}`.
- Put styles in a sibling `<component>.style.ts` that default-exports `Discord.createStyles({ … })`, with camelCase keys.
- Take every colour, shadow and font from the metro `Theme` and `Constants` namespaces: `Theme.colors.BACKGROUND_SURFACE_HIGH`, `Constants.Fonts.PRIMARY_SEMIBOLD`.

The test: the style file holds only theme tokens and layout numbers, so the component follows the user's Discord theme.
