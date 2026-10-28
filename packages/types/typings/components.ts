import type { DesignBarrelComponents } from '@unbound-app/discord-types/design';
import type { ImageStyle, TextStyle, ViewStyle } from 'react-native';
import type { ReactNode } from 'react';

import type { LiteralUnion } from './utils';

/** A function exported by a Discord module, whose signature Discord does not document. */
export type DiscordFunction<T = any> = (...args: any[]) => T;

/** A semantic colour token from `Theme.colors`, which `useToken` resolves to a colour string. */
export type SemanticColorToken = Readonly<Record<string, string | number | boolean>>;

/** The components of Discord's design module, each of which Unbound can stand in for when Discord drops it. */
export const DESIGN_COMPONENTS = [
	'Text',
	'Heading',
	'TableRow',
	'TableSwitchRow',
	'FormSwitch',
	'TableCheckboxRow',
	'TableRadioRow',
	'TableRadioGroup',
	'TableRowGroup',
	'TableRowGroupTitle',
	'TableRowIcon',
	'RowButton',
	'RowGroup',
	'Button',
	'IconButton',
	'ImageButton',
	'FloatingActionButton',
	'TextInput',
	'TextField',
	'TextArea',
	'TextAreaField',
	'SearchField',
	'GhostInput',
	'SplitTextInput',
	'Slider',
	'Checkbox',
	'SegmentedControl',
	'SegmentedControlPages',
	'Stack',
	'Card',
	'AlertModal',
	'AlertActionButton',
	'ActionSheet',
	'ActionSheetRow',
	'ContextMenu',
] as const satisfies readonly (keyof DesignComponents)[];

export type DesignComponentName = (typeof DESIGN_COMPONENTS)[number];

/** Every component the `design/native.tsx` barrel exports, typed only by `bun run generate-discord-types`. */
export type DesignComponents = DesignBarrelComponents;

/**
 * The Discord mobile design system module (keyed by `createStyles` / `dismissAlerts` / `ContextMenu`).
 * See `DESIGN.md` for the full catalogue.
 */
export type DesignModule = DesignComponents & DesignHelpers;

/** The design module's non-component exports (hooks, functions, constants), which the generator does not type. */
export type DesignHelpers = {
	/* Styling */
	createStyles: CreateStyles;
	TextStyleSheet: Record<TextVariant, TextStyle>;
	useToken: (token: SemanticColorToken) => string;

	/* Segmented control */
	useSegmentedControlState: (options: SegmentedControlStateOptions) => SegmentedControlState;

	/* Alerts, sheets & menus */
	openAlert: DiscordFunction<void>;
	dismissAlert: (key: string) => void;
	dismissAlerts: DiscordFunction<void>;
	showConfirmModal: DiscordFunction;
	showSimpleActionSheet: DiscordFunction;
	hideContextMenu: DiscordFunction<void>;

	/* Navigation */
	useNavigation: <T = any>() => Navigation<T>;

	/* Colour helpers */
	setColorOpacity: (color: string, opacity: number) => string;
	darkenColor: (color: string, amount: number) => string;
	brightenColor: (color: string, amount: number) => string;
	getContrastingColor: (color: string) => string;

	/* Runtime enums */
	TransitionStates: EnumLike<typeof TRANSITION_STATE_KEYS>;
	ThemeContextFlags: EnumLike<typeof THEME_FLAG_KEYS>;
	WCAGContrastRatios: Record<'NonText' | 'Text' | 'HighContrastText', number>;
};

/** A stylesheet spec: each key maps to a view, text, or image style. */
export type StyleSheetSpec = Record<string, ViewStyle | TextStyle | ImageStyle>;

/** Resolves each key of a {@link StyleSheetSpec} to the concrete RN style type it produced. */
export type ResolvedStyles<T extends StyleSheetSpec> = {
	[K in keyof T]: T[K] extends ImageStyle
		? ImageStyle
		: T[K] extends TextStyle
			? TextStyle
			: ViewStyle;
};

/** A stylesheet spec, or a function producing one (Discord accepts both forms). */
export type StyleSheetSpecOrFactory<T extends StyleSheetSpec> = T | ((...args: any[]) => T);

/**
 * The style factory: turns a spec (or a function returning one) into a theme-aware hook, so call it
 * inside a component body: `const styles = useStyles();`.
 */
export type CreateStyles = <T extends StyleSheetSpec>(
	styles: StyleSheetSpecOrFactory<T>,
) => () => ResolvedStyles<T>;

/* ------------------------------------------------------------------ *
 * Typography
 * ------------------------------------------------------------------ */

/** Every typography variant Discord ships in `TextStyleSheet`, kept open for new ones. */
export type TextVariant = LiteralUnion<
	| `heading-${'sm' | 'md' | 'lg' | 'xl' | 'xxl'}/${TextWeight | 'extrabold'}`
	| `experimental/heading-${'xs' | 'sm' | 'md' | 'lg' | 'xl' | 'xxl'}/${'semibold' | 'bold'}`
	| `heading-deprecated-12/${TextWeight | 'extrabold'}`
	| `redesign/heading-18/${'medium' | 'semibold' | 'bold'}`
	| `text-${'xxs' | 'xs' | 'sm' | 'md' | 'lg'}/${TextWeight}`
	| `redesign/message-preview/${TextWeight}`
	| `redesign/channel-title/${TextWeight}`
	| `experimental/body-${'xs' | 'sm' | 'md' | 'lg'}/${'normal' | 'medium'}`
	| `experimental/meta/${'normal' | 'medium'}`
	| `experimental/label-${'xs' | 'sm' | 'md' | 'lg'}/${'medium' | 'semibold'}`
	| `experimental/mono-${'sm' | 'md'}/${'normal' | 'bold'}`
	| `display-${'sm' | 'md' | 'lg'}`
	| `experimental/display-${'xs' | 'sm' | 'md' | 'lg'}`
	| 'eyebrow'
>;

/** The four common font weights used across typography variants. */
export type TextWeight = 'normal' | 'medium' | 'semibold' | 'bold';

/* ------------------------------------------------------------------ *
 * Segmented control state
 * ------------------------------------------------------------------ */

/** The state controller `useSegmentedControlState` returns, which drives a `SegmentedControl`. */
export type SegmentedControlState = {
	activeIndex: number;
	items: SegmentedControlItem[];
	setActiveIndex: (index: number) => void;
};

/** A tab of a segmented control, with the page it shows. */
export type SegmentedControlItem = {
	id: string;
	label: string;
	page?: ReactNode;
};

/** The options `useSegmentedControlState` builds a {@link SegmentedControlState} from. */
export type SegmentedControlStateOptions = {
	items: SegmentedControlItem[];
	pageWidth: number;
	defaultIndex?: number;
	onPageChange?: (index: number) => void;
};

/* ------------------------------------------------------------------ *
 * Navigation
 * ------------------------------------------------------------------ */

export type Navigation<T = any> = {
	push: (route: string, params?: T) => void;
	pop: () => void;
	navigate: (route: string, params?: T) => void;
	goBack: () => void;
	setOptions: (options: NavigationOptions) => void;
	addListener: (event: string, callback: DiscordFunction) => DiscordFunction<void>;
};

/** The screen options accepted by {@link Navigation.setOptions}. */
export type NavigationOptions = {
	title?: string;
	headerRight?: DiscordFunction<ReactNode>;
};

/* ------------------------------------------------------------------ *
 * Runtime enums
 * ------------------------------------------------------------------ */

/** Discord ships numeric enums as bidirectional maps; this models both directions. */
export type EnumLike<K extends readonly string[]> = { [P in K[number]]: number } & {
	[n: number]: K[number];
};

/** `TransitionStates`: MOUNTED = 0, ENTERED = 1, YEETED = 2. */
export type TransitionState = 'MOUNTED' | 'ENTERED' | 'YEETED';
declare const TRANSITION_STATE_KEYS: readonly ['MOUNTED', 'ENTERED', 'YEETED'];

/** `ThemeContextFlags`: the theme feature flag bits (gradient themes, contrast, saturation). */
declare const THEME_FLAG_KEYS: readonly [
	'MOBILE_DARK_GRADIENT_THEME_ENABLED',
	'MOBILE_LIGHT_GRADIENT_THEME_ENABLED',
	'REDUCED_CONTRAST_ENABLED',
	'INCREASED_CONTRAST_ENABLED',
	'REDUCE_SATURATION_ENABLED',
];
