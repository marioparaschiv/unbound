# Design System

This documents the Discord design-system primitives Unbound composes for its UI. It is the reference for anyone building settings pages, addon views, or toasts. The rule from `CLAUDE.md` still applies: compose these primitives directly and verify live on device.

## The barrel

Discord ships its entire mobile design system as **one metro module**, keyed by `createStyles`, `dismissAlerts`, and `ContextMenu`. Unbound resolves it once and re-exports it as `Discord`:

```ts
// ~/api/metro/components.ts
export const Discord: DesignModule = findByPropsLazy('createStyles', 'dismissAlerts', 'ContextMenu');
```

The export is typed as `DesignModule` (`packages/types/typings/components.ts`). That interface names and types the primitives listed below, but keeps a `[key: PropertyKey]: any` index signature so unlisted members, and anything Discord adds in a future build, stay accessible without a type change. Add a precise type there when a member earns one; you never need to widen the barrel to use something new.

On the v3 branch this same module was aliased `Design` (see `src/built-ins/registry.ts`, `types/discord/components.d.ts` typed it as `ComponentsModule`). It is the same module; only the name changed. There is no separate barrel to find. Everything below lives on `Discord.*`.

Adjacent module barrels (not part of this design-system module) live in `~/api/metro/common.ts`: `Theme` (color tokens), `Constants` (`Fonts`, `Endpoints`), `Radius`, `Reanimated`, `Gestures`, `SVG`, `Flux`, `Dispatcher`. Reach for those for tokens and platform APIs; reach for `Discord` for components.

## How to use a primitive

```tsx
import { Discord } from '~/api/metro/components';

<Discord.TableRowGroup title={Messages.UNBOUND_GENERAL}>
	<Discord.TableRow
		label='Example'
		icon={<Discord.TableRowIcon source={Icons.SettingsIcon} />}
		trailing={<Discord.TableRow.TrailingText text='value' />}
		arrow
		onPress={handlePress}
	/>
</Discord.TableRowGroup>
```

Styles come from `Discord.createStyles({ … })` in a sibling `*.style.ts`; reference tokens through `Theme.colors.*` and `Constants.Fonts.*`, never hard-coded values (see `CLAUDE.md` §8.4).

---

## Primitives by category

### Layout & tables

The table-row family is the backbone of every settings page.

| Primitive | Notes |
| --- | --- |
| `TableRowGroup` | Rounded group container. Takes a `title`; children are rows. |
| `TableRowGroupTitle` | Standalone group heading. |
| `TableRow` | The row. Statics: `TableRow.Icon`, `TableRow.Arrow`, `TableRow.TrailingText`. Props include `label`, `subLabel`, `icon`, `trailing`, `arrow`, `start`, `end`, `onPress`. `start`/`end` set the rounded corners for first/last row in a manual list. |
| `TableRowIcon` | Leading icon slot. `source={id}` or `variant`. |
| `TableSwitchRow` | Row with a trailing switch. `value` / `onValueChange`. |
| `TableCheckboxRow` | Row with a trailing checkbox. |
| `TableRadioGroup` / `TableRadioRow` | Single-select radio rows. |
| `RowGroup` / `RowButton` | Lighter-weight button-style rows (`RowButton.Icon`). |
| `Stack` | Flex layout helper (spacing/direction). |
| `Card` | Bordered/elevated container. `variant`, `shadow`, `border`. |
| `TABLE_ROW_HEIGHT`, `TABLE_ROW_CONTENT_HEIGHT` | Layout constants. |

### Text & typography

| Primitive | Notes |
| --- | --- |
| `Text` | Base text. `variant` (a `TextStyleSheet` key) + `color` (a `Theme` token literal). |
| `Heading` | Semantic heading. |
| `TextStyleSheet` | Runtime map of every typography variant. Keys look like `heading-sm/semibold`, `text-md/medium`, `display-lg`, `eyebrow`, `code`. Use these strings for `Text`'s `variant`. |

### Inputs

| Primitive | Notes |
| --- | --- |
| `TextInput` | Discord's **own** form-style input, not React Native's. `onChange` receives the raw **string** value (not an event). Own props: `value`, `placeholder`, `title`, `helpText`, `error`, `disabled`, `showBorder`, `multiline`, `clearButtonVisibility`, `allowRedesignTextInput`. Its redesign path also accepts `size`, `isClearable`, `leadingIcon`, `borderRadius` (what the asset browser uses). |
| `TextField` / `TextArea` / `TextAreaField` | The newer field components with label/clear chrome. `size`, `status`, `isClearable`, `leadingIcon`, `onChange(value)`, `onClear`. |
| `SplitTextInput` | Segmented input (e.g. codes). |
| `SearchField` | Thin wrapper over `TextField` that hardcodes the search icon + clear button. (Asset browser deliberately uses `TextInput size='md'` instead, to match row roundness.) |
| `GhostInput` | Borderless inline input; bridges to the `useTextField` / `InputProps` family. |
| `Checkbox`, `Slider`, `SegmentedControl` (+ `SegmentedControlItem`, `SegmentedControlPages`), `Tabs` | Selection controls. |
| `InputSize`, `InputStatus` | Type-level enums (undefined at runtime). |

### Buttons

| Primitive | Notes |
| --- | --- |
| `Button` | Primary button. Static `Button.Icon`. |
| `IconButton` | Icon-only button. |
| `ImageButton` | Image-backed button. |
| `FloatingActionButton` | FAB. |
| `ButtonGroup` | Grouped buttons. |
| `HeaderActionButton` | Nav-bar action button. |

### Overlays, modals & sheets

| Primitive | Notes |
| --- | --- |
| `Modal`, `ModalScreen`, `ModalContent`, `ModalFooter`, `ModalActionButton`, `ModalDisclaimer`, `ModalStepIndicator`, `ModalFloatingAction` | Modal composition set. |
| `StepModal` | Multi-step modal wrapper. |
| `AlertModal`, `AlertModalContainer`, `AlertActionButton`, `openAlert`, `dismissAlert`, `dismissAlerts`, `showConfirmModal` | Alert dialogs + imperative helpers. |
| `Dialog` | Dialog primitive. |
| `ActionSheet` (+ `SimpleActionSheet`, `ActionSheetRow`, `ActionSheetOption`, `ActionSheetSwitchRow`, `ActionSheetHeaderBar`, `showSimpleActionSheet`) | Bottom action sheets. |
| `BottomSheet` (+ `BottomSheetHandle`, `BottomSheetTitleHeader`, `BottomSheetTextInput`) | Draggable bottom sheet. |
| `ContextMenu`, `ContextMenuContainer`, `hideContextMenu` | Context menus. |
| `Menu`, `MenuGroup`, `MenuItem`, `MenuPopout` | Popover menus. |
| `PromoSheet` | Promotional sheet. |
| `Toast` | Native toast (Unbound ships its own toast system in `~/ui/toasts`). |
| `Backdrop`, `NavScrim` | Dimming layers. |

### Navigation

| Primitive | Notes |
| --- | --- |
| `Navigator`, `NavigatorHeader`, `NavigatorScreen`, `NavigationRoute` | Stack navigation. |
| `useNavigation`, `useStackNavigation`, `useNativeStackNavigation`, `useTabNavigation` | Navigation hooks. `useNavigation()` is what settings pages use for `navigation.push(Screens.X)`. |
| `getHeaderBackButton`, `getHeaderCloseButton`, `getHeaderTextButton`, `getHeaderNoTitle` | Header button factories. |

### Avatars & piles

`AvatarPile`, `AvatarDuoPile`, `GuildIconPile`, `Pile`, `PileOverflow` — stacked avatar/icon groups.

### Feedback & motion

| Primitive | Notes |
| --- | --- |
| `ActivityIndicator`, `SceneLoadingIndicator`, `HeaderSubmittingIndicator` | Spinners. |
| `TransitionGroup`, `TransitionItem`, `AnimatedEnterExitItem` | Enter/exit animation host. The native toast container uses `TransitionGroup` with `items`/`renderItem`/`getItemKey`/`wrapChildren`. |
| `ExpressiveGradient` | Animated gradient. |
| `*Lottie` (`NitroGem*`, `MicrophoneLottie`, `MessagesTabLottie`, tab lotties, …) | Prebuilt Lottie animations with `*State` companions. |
| `withSpring`, `withTiming`, `springStandard`, `springSlow`, `springUnclamped`, `SUBTLE_SPRING`, `ON_PRESS_SPRING`, `timingFast`, `timingStandard`, `timingSlow` | Motion presets and helpers. |
| `SpringConfig`, `TimingConfig` | Config shapes. |

### Theming & styles

| Primitive | Notes |
| --- | --- |
| `createStyles` | The stylesheet factory. Returns a hook; keys are `camelCase`; supports `ViewStyle`/`TextStyle`/`ImageStyle`. |
| `createStyleProperties`, `createNativeStyleProperties`, `createLegacyClassComponentStyles`, `useLegacyClassComponentStyles` | Lower-level style builders. |
| `useThemeContext`, `useToken`, `experimental_createToken` | Theme context + design tokens. |
| `ThemeContextProvider`, `RootThemeContextProvider`, `ThemeType` | Theme wiring. |
| `isThemeDark`, `isThemeLight`, `hasThemeFlag`, `setThemeFlag` | Theme predicates. |
| `brightenColor`, `darkenColor`, `setColorOpacity`, `getContrastingColor`, `getSemanticColorContextFromThemeContext` | Color math. Prefer `Theme.colors.*` tokens over hand-rolled color math. |
| `mergeProps`, `mergeRefs`, `chainCallbacks`, `getNodeText` | Composition utilities. |

### Accessibility

`AccessibilityView`, `AccessibilityAnnouncer`, `AccessibilityPreferences`, `MotionPreference`, `ContrastPreference`, `ForcedColorsPreference`, `WCAGContrastRatios`, and the `use*A11y*` hooks.

---

## Notes for contributors

- **One module, verify live.** The barrel's contents shift between Discord versions. When a primitive is missing or a prop changed, resolve the module live (`unbound.metro.findByProps('createStyles','dismissAlerts','ContextMenu')`) and inspect it, rather than trusting a stale type.
- **Type-only exports.** The Discord module also exports names ending in `Props`, plus type-level enums like `InputSize`, `InputStatus`, `TableRowIconVariant`, `ModalActionButtonVariant`, `ThemeType` — these are `undefined` at runtime (TypeScript's own upstream surface, not real values). Do not read them off `Discord.*`.
- **Real runtime enums.** A few members *are* live objects: `TransitionStates` (`MOUNTED` 0, `ENTERED` 1, `YEETED` 2), `ThemeContextFlags` (bidirectional flag bits), `WCAGContrastRatios` (`NonText` 3, `Text` 4.5, `HighContrastText` 7), and the motion presets (`springStandard`, `timingFast`, …). These are typed on `DesignModule`.
- **Radius tokens** come from the separate `Radius` module (`Radius.Radius.sm|md|lg` = 8|12|16). `TableRowGroup` uses `lg`.
- **Color/typography tokens** come from `Theme` and `Constants`, not from this module. See the design-tokens memory for current live token names.
