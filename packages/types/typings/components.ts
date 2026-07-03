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
	TextArea: ComponentType<TextFieldProps>;
	SearchField: ComponentType<Omit<TextFieldProps, 'leadingIcon'>>;
	GhostInput: ComponentType<TextFieldProps>;
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

/** The style factory: takes a stylesheet spec and returns a hook resolving each key to its style. */
export type CreateStyles = <T extends StyleSheetSpec>(styles: T) => Fn<ResolvedStyles<T>>;

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

export type InputSize = LiteralUnion<'sm' | 'md' | 'lg'>;
export type InputStatus = LiteralUnion<'default' | 'error'>;

/**
 * Discord's own form-style `TextInput` (not React Native's). Its `onChange` receives the raw string
 * value, not an event. A few `TextField`-style props (`size`, `isClearable`, `leadingIcon`,
 * `borderRadius`) are accepted through its redesign render path, so they are included here too. The
 * standard RN input props it forwards (`maxLength`, `selectionColor`, …) come from the intersection
 * with {@link RNInputPassthrough}.
 */
export type TextInputProps = DesignTextInputProps & RedesignTextInputProps & RNInputPassthrough;

/** The `TextInput.native` component's own props, read verbatim off its props object. */
export interface DesignTextInputProps {
	value?: string;
	placeholder?: string;
	/** Field label rendered above the input. */
	title?: string;
	helpText?: string;
	/** Error message, or `true` to show the error state without text. */
	error?: string | boolean;
	disabled?: boolean;
	multiline?: boolean;
	numberOfLines?: number;
	autoFocus?: boolean;
	secureTextEntry?: boolean;
	returnKeyType?: RNTextInputProps['returnKeyType'];
	keyboardType?: RNTextInputProps['keyboardType'];
	keyboardAppearance?: RNTextInputProps['keyboardAppearance'];
	autoCapitalize?: RNTextInputProps['autoCapitalize'];
	autoCorrect?: boolean;
	clearButtonVisibility?: LiteralUnion<'never' | 'always' | 'unless-editing' | 'while-editing'>;
	showBorder?: boolean;
	showCharactersRemaining?: boolean;
	inputTextStyle?: StyleProp<TextStyle>;
	style?: StyleProp<ViewStyle>;
	enableAndroidSanitizedInputWorkaround?: boolean;
	/** Switches between the legacy and redesign render paths. */
	allowRedesignTextInput?: boolean;
	onChange?: (value: string) => void;
}

/** `TextField`-family props the redesign `TextInput` path also accepts. */
export interface RedesignTextInputProps {
	size?: InputSize;
	status?: InputStatus;
	isClearable?: boolean;
	isDisabled?: boolean;
	isRound?: boolean;
	borderRadius?: number;
	leadingIcon?: ComponentType<any> | ReactNode | Fn<ReactNode>;
	trailingIcon?: ComponentType<any> | ReactNode | Fn<ReactNode>;
	leadingText?: string;
	trailingText?: string;
}

/** The subset of native `TextInput` props forwarded through to the underlying input. */
export type RNInputPassthrough = Omit<
	RNTextInputProps,
	keyof DesignTextInputProps | keyof RedesignTextInputProps | 'onChange'
>;

/** The newer `TextField` component. Shares the redesign surface; adds label/clear chrome. */
export interface TextFieldProps extends RedesignTextInputProps, RNInputPassthrough {
	value?: string;
	defaultValue?: string;
	placeholder?: string;
	label?: string;
	description?: string;
	errorMessage?: string;
	grow?: boolean;
	onChange?: (value: string) => void;
	onClear?: Fn<void>;
}

export interface SliderProps {
	value?: number;
	minimumValue?: number;
	maximumValue?: number;
	step?: number;
	disabled?: boolean;
	startIcon?: ReactNode;
	endIcon?: ReactNode;
	style?: StyleProp<ViewStyle>;
	onValueChange?: (value: number) => void;
}

export interface CheckboxProps {
	label?: ReactNode;
	description?: ReactNode;
	checked: boolean;
	required?: boolean;
	onToggle: Fn<void>;
}

export interface SegmentedControlProps {
	state: any;
	variant?: LiteralUnion<'default'>;
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
