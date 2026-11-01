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

/** The name of one component in {@link DESIGN_COMPONENTS}. */
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
	/** Discord's theme-aware style factory; see {@link CreateStyles}. */
	createStyles: CreateStyles;
	/** The text style Discord uses for each typography variant. */
	TextStyleSheet: Record<TextVariant, TextStyle>;
	/** Hook that resolves a semantic colour token, such as `Theme.colors.TEXT_DEFAULT`, to a colour for the current theme. */
	useToken: (token: SemanticColorToken) => string;

	/* Segmented control */
	/** Hook that builds the state a `SegmentedControl` and its `SegmentedControlPages` share. */
	useSegmentedControlState: (options: SegmentedControlStateOptions) => SegmentedControlState;

	/* Alerts, sheets & menus */
	/** Opens an alert as `openAlert(key, element)`; pass the same key to `dismissAlert` to close it. */
	openAlert: DiscordFunction<void>;
	/** Closes the alert opened under `key`. */
	dismissAlert: (key: string) => void;
	/** Closes every open alert. */
	dismissAlerts: DiscordFunction<void>;
	/** Shows a confirm modal from `{ title, content, confirmText, cancelText, onConfirm }`. */
	showConfirmModal: DiscordFunction;
	/** Shows an action sheet from `{ key, header: { title }, options: [{ label, icon, onPress }] }`. */
	showSimpleActionSheet: DiscordFunction;
	/** Closes the open context menu, such as after a plugin's menu item runs. */
	hideContextMenu: DiscordFunction<void>;

	/* Navigation */
	/** Hook that returns the navigation of the screen the calling component renders in. */
	useNavigation: <T = any>() => Navigation<T>;

	/* Colour helpers */
	/** Returns `color` with its opacity set to `opacity`. */
	setColorOpacity: (color: string, opacity: number) => string;
	/** Returns `color` darkened by `amount`. */
	darkenColor: (color: string, amount: number) => string;
	/** Returns `color` brightened by `amount`. */
	brightenColor: (color: string, amount: number) => string;
	/** Returns a colour that contrasts with `color`, for content drawn on it. */
	getContrastingColor: (color: string) => string;

	/* Runtime enums */
	/** Discord's transition state enum; see {@link TransitionState}. */
	TransitionStates: EnumLike<typeof TRANSITION_STATE_KEYS>;
	/** Discord's theme flag enum: gradient themes, reduced or increased contrast, and reduced saturation. */
	ThemeContextFlags: EnumLike<typeof THEME_FLAG_KEYS>;
	/** The minimum WCAG contrast ratios Discord applies to non-text, text and high-contrast text. */
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
	/** The index of the selected tab in `items`. */
	activeIndex: number;
	/** The tabs, in display order. */
	items: SegmentedControlItem[];
	/** Selects the tab at `index`. */
	setActiveIndex: (index: number) => void;
};

/** A tab of a segmented control, with the page it shows. */
export type SegmentedControlItem = {
	/** A key unique among the control's tabs. */
	id: string;
	/** The text shown on the tab. */
	label: string;
	/** What `SegmentedControlPages` renders while this tab is selected. */
	page?: ReactNode;
};

/** The options `useSegmentedControlState` builds a {@link SegmentedControlState} from. */
export type SegmentedControlStateOptions = {
	/** The tabs, in display order. */
	items: SegmentedControlItem[];
	/** The width of one page in points; Unbound passes the window width. */
	pageWidth: number;
	/** The index of the tab selected first. */
	defaultIndex?: number;
	/** Called with the new index when the selected page changes. */
	onPageChange?: (index: number) => void;
};

/* ------------------------------------------------------------------ *
 * Navigation
 * ------------------------------------------------------------------ */

/** A screen's handle on Discord's React Navigation stack, as `useNavigation` returns it. */
export type Navigation<T = any> = {
	/** Pushes a new screen for `route` with `params` onto the stack. */
	push: (route: string, params?: T) => void;
	/** Removes the top screen from the stack. */
	pop: () => void;
	/** Goes to `route`, reusing a screen already on the stack for it. */
	navigate: (route: string, params?: T) => void;
	/** Returns to the previous screen. */
	goBack: () => void;
	/** Updates the current screen's header options. */
	setOptions: (options: NavigationOptions) => void;
	/** Subscribes to a navigation event, such as `focus`; returns a function that unsubscribes. */
	addListener: (event: string, callback: DiscordFunction) => DiscordFunction<void>;
};

/** The screen options accepted by {@link Navigation.setOptions}. */
export type NavigationOptions = {
	/** The header title. */
	title?: string;
	/** Renders the element shown at the header's right edge. */
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
