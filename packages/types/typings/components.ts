import type {
	ImageStyle,
	StyleProp,
	TextInputProps as RNTextInputProps,
	TextStyle,
	ViewProps,
	ViewStyle,
} from 'react-native';
import type { ComponentType, ReactNode } from 'react';

import type { Fn, LiteralUnion } from './utils';

/**
 * The Discord mobile design system. This is the single metro module keyed by
 * `createStyles` / `dismissAlerts` / `ContextMenu` (aliased `Design` on the v3 branch). It is
 * intentionally left open: every listed member is precisely typed, and the index signature keeps
 * the rest (and anything Discord adds in a future build) accessible as `any` without a change here.
 *
 * See `DESIGN.md` at the repo root for the full catalogue.
 */
export interface DesignModule {
	/* Styling */
	createStyles: CreateStyles;
	TextStyleSheet: Record<TextVariant, TextStyle>;

	/* Typography */
	Text: ComponentType<TextProps>;
	Heading: ComponentType<TextProps>;

	/* Tables & rows */
	TableRow: TableRowComponent;
	TableSwitchRow: ComponentType<TableSwitchRowProps>;
	TableCheckboxRow: ComponentType<TableCheckboxRowProps>;
	TableRadioRow: ComponentType<TableRadioRowProps>;
	TableRowGroup: ComponentType<TableRowGroupProps>;
	TableRowGroupTitle: ComponentType<TableRowGroupTitleProps>;
	TableRowIcon: ComponentType<TableRowIconProps>;
	RowButton: ComponentType<RowButtonProps>;
	RowGroup: ComponentType<ViewProps>;

	/* Buttons */
	Button: ButtonComponent;
	IconButton: ComponentType<IconButtonProps>;
	ImageButton: ComponentType<ViewProps>;
	FloatingActionButton: ComponentType<ViewProps>;

	/* Inputs */
	TextInput: ComponentType<TextInputProps>;
	TextField: ComponentType<TextFieldProps>;
	TextArea: ComponentType<TextAreaProps>;
	TextAreaField: ComponentType<TextAreaProps>;
	SearchField: ComponentType<Omit<TextFieldProps, 'leadingIcon'>>;
	GhostInput: ComponentType<GhostInputProps>;
	SplitTextInput: ComponentType<SplitTextInputProps>;
	Slider: ComponentType<SliderProps>;
	Checkbox: ComponentType<CheckboxProps>;
	SegmentedControl: ComponentType<SegmentedControlProps>;

	/* Layout & surfaces */
	Stack: ComponentType<StackProps>;
	Card: ComponentType<CardProps>;

	/* Alerts & sheets */
	openAlert: Fn<void>;
	dismissAlert: (key: string) => void;
	dismissAlerts: Fn<void>;
	showConfirmModal: Fn;
	showSimpleActionSheet: Fn;
	hideContextMenu: Fn<void>;

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

	/* Everything else Discord exposes on this module (Lotties, modals, menus, motion presets, …). */
	[key: PropertyKey]: any;
}

/** A stylesheet spec: each key maps to a view, text, or image style. */
export type StyleSheetSpec = Record<
	string,
	ViewStyle | TextStyle | ImageStyle | Record<PropertyKey, any>
>;

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
 * The style factory. Accepts a spec object (or a function returning one) and returns a hook. The
 * hook subscribes to the theme context and lazily resolves each key on access, so it must be called
 * inside a component body: `const styles = useStyles();`.
 */
export type CreateStyles = <T extends StyleSheetSpec>(
	styles: StyleSheetSpecOrFactory<T>,
) => Fn<ResolvedStyles<T>>;

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

export interface TextProps extends ViewProps {
	children?: ReactNode;
	variant?: TextVariant;
	color?: LiteralUnion<'text-normal' | 'text-muted' | 'header-primary' | 'header-secondary'>;
	style?: StyleProp<TextStyle>;
	lineClamp?: number;
	ellipsizeMode?: 'head' | 'middle' | 'tail' | 'clip';
	tabularNumbers?: boolean;
	animated?: boolean;
	numberOfLines?: number;
	allowFontScaling?: boolean;
}

/* ------------------------------------------------------------------ *
 * Tables & rows
 * ------------------------------------------------------------------ */

export interface TableRowProps {
	label?: ReactNode;
	subLabel?: ReactNode;
	icon?: ReactNode;
	trailing?: ReactNode;
	arrow?: boolean;
	disabled?: boolean;
	/** Rounds the top corners; set on the first row of a manually laid-out group. */
	start?: boolean;
	/** Rounds the bottom corners; set on the last row of a manually laid-out group. */
	end?: boolean;
	labelLineClamp?: number;
	subLabelLineClamp?: number;
	variant?: LiteralUnion<'default' | 'danger'>;
	draggable?: boolean;
	onPress?: Fn<void>;
	children?: ReactNode;
}

/** `TableRow` with its attached statics (`Icon`, `Arrow`, `TrailingText`). */
export type TableRowComponent = ComponentType<TableRowProps> & {
	Icon: ComponentType<TableRowIconProps>;
	Arrow: ComponentType<ViewProps>;
	TrailingText: ComponentType<TrailingTextProps>;
};

export interface TrailingTextProps {
	text: string;
}

export interface TableSwitchRowProps {
	label?: ReactNode;
	subLabel?: ReactNode;
	icon?: ReactNode;
	trailing?: ReactNode;
	value: boolean;
	disabled?: boolean;
	accessibilityHint?: string;
	variant?: LiteralUnion<'default'>;
	onValueChange: (value: boolean) => void;
}

export interface TableCheckboxRowProps {
	label?: ReactNode;
	subLabel?: ReactNode;
	checked: boolean;
	disabled?: boolean;
	accessibilityHint?: string;
	onPress: Fn<void>;
}

export interface TableRadioRowProps {
	label?: ReactNode;
	subLabel?: ReactNode;
	value: any;
	disabled?: boolean;
	accessibilityHint?: string;
	legacyCompat?: boolean;
}

export interface TableRowGroupProps {
	title?: string;
	description?: string;
	helperText?: string;
	hasIcons?: boolean;
	hasTrailingText?: boolean;
	accessibilityRole?: string;
	accessibilityLabel?: string;
	children?: ReactNode;
}

export interface TableRowGroupTitleProps {
	title: string;
}

export interface TableRowIconProps {
	source?: number;
	IconComponent?: ComponentType<any>;
	variant?: LiteralUnion<'default' | 'danger' | 'blurple'>;
}

export interface RowButtonProps {
	label?: ReactNode;
	icon?: ReactNode;
	arrow?: boolean;
	disabled?: boolean;
	variant?: LiteralUnion<'primary' | 'secondary'>;
	onPress?: Fn<void>;
}

/* ------------------------------------------------------------------ *
 * Buttons
 * ------------------------------------------------------------------ */

export type ButtonVariant = LiteralUnion<
	'primary' | 'secondary' | 'tertiary' | 'destructive' | 'active' | 'expressive'
>;
export type ButtonSize = LiteralUnion<'sm' | 'md' | 'lg'>;

export interface ButtonProps {
	text?: string;
	textElement?: ReactNode;
	variant?: ButtonVariant;
	size?: ButtonSize;
	loading?: boolean;
	disabled?: boolean;
	icon?: ReactNode | number;
	iconPosition?: 'start' | 'end';
	grow?: boolean;
	shrink?: boolean;
	shiny?: boolean;
	textVariant?: TextVariant;
	style?: StyleProp<ViewStyle>;
	accessibilityLabel?: string;
	onPress?: Fn<void>;
	onPressIn?: Fn<void>;
	onPressOut?: Fn<void>;
}

/** `Button` with its attached `Icon` static. */
export type ButtonComponent = ComponentType<ButtonProps> & {
	Icon: ComponentType<TableRowIconProps>;
};

export interface IconButtonProps {
	icon?: ReactNode | number;
	variant?: ButtonVariant;
	size?: ButtonSize;
	loading?: boolean;
	disabled?: boolean;
	label?: string;
	accessibilityLabel?: string;
	style?: StyleProp<ViewStyle>;
	onPress?: Fn<void>;
}

/* ------------------------------------------------------------------ *
 * Inputs
 * ------------------------------------------------------------------ */

/** Input sizing, shared by the whole `TextField`/`Input` family. */
export type InputSize = LiteralUnion<'sm' | 'md' | 'lg'>;
/** Input status. `focused` is an internal state and is not user-settable. */
export type InputStatus = LiteralUnion<'default' | 'error'>;
/** Icon slot: a rendered node, a component, or a render function. */
export type IconSlot = ReactNode | ComponentType<any> | Fn<ReactNode>;

/**
 * Discord's own form-style `TextInput` (`TextInput.native`), not React Native's. Its `onChange`
 * receives the raw string value, not an event. These are the props it reads verbatim off its props
 * object; every other prop is collected and spread onto the underlying native input via
 * {@link TextInputPassthrough}.
 */
export interface TextInputProps extends TextInputPassthrough {
	value?: string;
	/** @default '' */
	placeholder?: string;
	/** Field label rendered above the input. @default '' */
	title?: string;
	/** @default '' */
	helpText?: string;
	/** Error message, or `true` to show the error state without text. */
	error?: string | boolean;
	/** @default false */
	disabled?: boolean;
	/** @default false */
	multiline?: boolean;
	/** @default 1 */
	numberOfLines?: number;
	/** @default false */
	autoFocus?: boolean;
	/** @default false */
	secureTextEntry?: boolean;
	keyboardType?: RNTextInputProps['keyboardType'];
	keyboardAppearance?: RNTextInputProps['keyboardAppearance'];
	autoCapitalize?: RNTextInputProps['autoCapitalize'];
	autoCorrect?: boolean;
	/** iOS clear-button mode; forwarded to the native input. */
	clearButtonVisibility?: LiteralUnion<'never' | 'always' | 'unless-editing' | 'while-editing'>;
	showBorder?: boolean;
	/** @default false */
	showCharactersRemaining?: boolean;
	inputTextStyle?: StyleProp<TextStyle>;
	style?: StyleProp<ViewStyle>;
	/** @default false */
	enableAndroidSanitizedInputWorkaround?: boolean;
	/** Switches between the legacy and redesign render paths. @default true */
	allowRedesignTextInput?: boolean;
	onChange?: (value: string) => void;
}

/**
 * Native `TextInput` props forwarded through `TextInput`. Everything the DS component does not read
 * itself (`maxLength`, `selectionColor`, `onFocus`, …) is spread onto the underlying native input,
 * so it accepts the RN surface too, minus the members `TextInput` overrides with its own semantics.
 */
export type TextInputPassthrough = Omit<
	RNTextInputProps,
	| 'value'
	| 'placeholder'
	| 'multiline'
	| 'numberOfLines'
	| 'autoFocus'
	| 'secureTextEntry'
	| 'keyboardType'
	| 'keyboardAppearance'
	| 'autoCapitalize'
	| 'autoCorrect'
	| 'style'
	| 'onChange'
>;

/**
 * The redesign `TextField` and its siblings (`TextArea`, `SearchField`, `GhostInput`,
 * `SplitTextInput`). This is where the `size` / `status` / `isClearable` / `leadingIcon` chrome
 * actually lives, unlike {@link TextInputProps}. `onChange` receives the string value.
 */
export interface TextFieldProps {
	value?: string;
	defaultValue?: string;
	placeholder?: string;
	size?: InputSize;
	/** @default 'default' */
	status?: InputStatus;
	isClearable?: boolean;
	isDisabled?: boolean;
	isRound?: boolean;
	grow?: boolean;
	leadingIcon?: IconSlot;
	trailingIcon?: IconSlot;
	leadingText?: string;
	trailingText?: string;
	leadingPressableProps?: Record<string, any>;
	trailingPressableProps?: Record<string, any>;
	secureTextEntry?: boolean;
	keyboardType?: RNTextInputProps['keyboardType'];
	autoComplete?: RNTextInputProps['autoComplete'];
	returnKeyType?: RNTextInputProps['returnKeyType'];
	maxLength?: number;
	enableAndroidSanitizedInputWorkaround?: boolean;
	style?: StyleProp<ViewStyle>;
	inputStyle?: StyleProp<TextStyle>;
	children?: ReactNode;
	onChange?: (value: string) => void;
	onClear?: Fn<void>;
	onFocus?: RNTextInputProps['onFocus'];
	onBlur?: RNTextInputProps['onBlur'];
}

/** `TextArea` extends the field family with a character limit. */
export interface TextAreaProps extends TextFieldProps {
	maxLength?: number;
}

/** `GhostInput`: a borderless field bridging to the `useTextField` hook. */
export interface GhostInputProps extends TextFieldProps {
	isCentered?: boolean;
	autoFocus?: boolean;
	containerStyle?: StyleProp<ViewStyle>;
}

/** `SplitTextInput` / `SplitTextField`: a segmented input (e.g. verification codes). */
export interface SplitTextInputProps extends TextFieldProps {
	isRound?: boolean;
	leadingText?: string;
	leadingPressableProps?: Record<string, any>;
}

/**
 * The DS `Slider`. It reads only `startIcon` / `endIcon` / `style` / `onValueChange` / `step`; the
 * remaining slider props (`value`, bounds, tint colours) are spread onto the underlying RN slider.
 */
export interface SliderProps {
	value?: number;
	defaultValue?: number;
	minimumValue?: number;
	maximumValue?: number;
	step?: number;
	disabled?: boolean;
	inverted?: boolean;
	tapToSeek?: boolean;
	lowerLimit?: number;
	upperLimit?: number;
	startIcon?: ReactNode;
	endIcon?: ReactNode;
	valueLabel?: ReactNode;
	minimumTrackTintColor?: string;
	maximumTrackTintColor?: string;
	style?: StyleProp<ViewStyle>;
	onValueChange?: (value: number) => void;
	onSlidingStart?: (value: number) => void;
	onSlidingComplete?: (value: number) => void;
}

export interface CheckboxProps {
	label?: ReactNode;
	description?: ReactNode;
	checked: boolean;
	required?: boolean;
	accessibilityRole?: string;
	accessibilityState?: Record<string, any>;
	onToggle: Fn<void>;
}

export interface SegmentedControlProps {
	/** The controller returned by `useSegmentedControlState`. */
	state: SegmentedControlState;
	/** @default 'default' */
	variant?: LiteralUnion<'default'>;
	keyboardShouldPersistTaps?: boolean | 'always' | 'never' | 'handled';
}

/** The state controller a `SegmentedControl` is driven by. */
export interface SegmentedControlState {
	activeIndex: number;
	items: any[];
	setActiveIndex: (index: number) => void;
}

/* ------------------------------------------------------------------ *
 * Layout & surfaces
 * ------------------------------------------------------------------ */

export interface StackProps extends ViewProps {
	spacing?: number;
	direction?: 'horizontal' | 'vertical';
	align?: 'start' | 'center' | 'end' | 'stretch';
	justify?: 'start' | 'center' | 'end' | 'between' | 'around';
	children?: ReactNode;
}

export interface CardProps extends ViewProps {
	variant?: LiteralUnion<'primary' | 'secondary' | 'muted' | 'transparent'>;
	border?: LiteralUnion<'none' | 'subtle' | 'strong'>;
	shadow?: LiteralUnion<'none' | 'low' | 'medium' | 'high' | 'border'>;
	radius?: number;
	start?: boolean;
	end?: boolean;
	children?: ReactNode;
}

/* ------------------------------------------------------------------ *
 * Navigation
 * ------------------------------------------------------------------ */

export interface Navigation<T = any> {
	push: (route: string, params?: T) => void;
	pop: () => void;
	navigate: (route: string, params?: T) => void;
	goBack: () => void;
	setOptions: (options: Record<string, any>) => void;
	addListener: (event: string, callback: Fn) => Fn<void>;
	[key: string]: any;
}

/* ------------------------------------------------------------------ *
 * Runtime enums (bidirectional key<->value objects Discord ships)
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
