import type {
	AccessibilityState,
	ImageStyle,
	PressableProps,
	StyleProp,
	TextInputProps as RNTextInputProps,
	TextStyle,
	ViewProps,
	ViewStyle,
} from 'react-native';
import type { ComponentType, ReactNode } from 'react';

import type { LiteralUnion } from './utils';

/** A function exported by a Discord module, whose signature Discord does not document. */
export type DiscordFunction<T = any> = (...args: any[]) => T;

/**
 * The Discord mobile design system module (keyed by `createStyles` / `dismissAlerts` / `ContextMenu`).
 * See `DESIGN.md` for the full catalogue.
 */
export type DesignModule = {
	/* Styling */
	createStyles: CreateStyles;
	TextStyleSheet: Record<TextVariant, TextStyle>;

	/* Typography */
	Text: ComponentType<TextProps>;
	Heading: ComponentType<TextProps>;

	/* Tables & rows */
	TableRow: TableRowComponent;
	TableSwitchRow: ComponentType<TableSwitchRowProps>;
	FormSwitch: ComponentType<SwitchProps>;
	TableCheckboxRow: ComponentType<TableCheckboxRowProps>;
	TableRadioRow: ComponentType<TableRadioRowProps>;
	TableRadioGroup: ComponentType<TableRadioGroupProps>;
	TableRowGroup: ComponentType<TableRowGroupProps>;
	TableRowGroupTitle: ComponentType<TableRowGroupTitleProps>;
	TableRowIcon: ComponentType<TableRowIconProps>;
	RowButton: ComponentType<RowButtonProps>;
	RowGroup: ComponentType<ViewProps>;

	/* Buttons */
	Button: ButtonComponent;
	IconButton: ComponentType<IconButtonProps>;
	ImageButton: ComponentType<ViewProps>;
	FloatingActionButton: ComponentType<FloatingActionButtonProps>;

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
	SegmentedControlPages: ComponentType<SegmentedControlPagesProps>;
	useSegmentedControlState: (options: SegmentedControlStateOptions) => SegmentedControlState;

	/* Layout & surfaces */
	Stack: ComponentType<StackProps>;
	Card: ComponentType<CardProps>;

	/* Alerts, sheets & menus */
	AlertModal: ComponentType<AlertModalProps>;
	AlertActionButton: ComponentType<AlertActionButtonProps>;
	ActionSheet: ComponentType<ActionSheetProps>;
	ActionSheetRow: ComponentType<ActionSheetRowProps>;
	ContextMenu: ComponentType<ContextMenuProps>;
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

export type TextProps = {
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
} & ViewProps;

/* ------------------------------------------------------------------ *
 * Tables & rows
 * ------------------------------------------------------------------ */

export type TableRowProps = {
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
	onPress?: DiscordFunction<void>;
	children?: ReactNode;
};

/** `TableRow` with its attached statics (`Icon`, `Arrow`, `TrailingText`). */
export type TableRowComponent = ComponentType<TableRowProps> & {
	Icon: ComponentType<TableRowIconProps>;
	Arrow: ComponentType<ViewProps>;
	TrailingText: ComponentType<TrailingTextProps>;
};

export type TrailingTextProps = {
	text: string;
};

export type TableSwitchRowProps = {
	label?: ReactNode;
	subLabel?: ReactNode;
	icon?: ReactNode;
	trailing?: ReactNode;
	value: boolean;
	disabled?: boolean;
	accessibilityHint?: string;
	variant?: LiteralUnion<'default'>;
	onValueChange: (value: boolean) => void;
};

export type SwitchProps = {
	value: boolean;
	disabled?: boolean;
	accessibilityLabel?: string;
	onValueChange: (value: boolean) => void;
};

export type TableCheckboxRowProps = {
	label?: ReactNode;
	subLabel?: ReactNode;
	checked: boolean;
	disabled?: boolean;
	accessibilityHint?: string;
	onPress: DiscordFunction<void>;
};

export type TableRadioRowProps = {
	label?: ReactNode;
	icon?: ReactNode;
	subLabel?: ReactNode;
	value: any;
	disabled?: boolean;
	accessibilityHint?: string;
	legacyCompat?: boolean;
};

export type TableRadioGroupProps = {
	title?: string;
	description?: string;
	value: any;
	hasIcons?: boolean;
	onChange: (value: any) => void;
	children?: ReactNode;
};

export type TableRowGroupProps = {
	title?: string;
	description?: string;
	helperText?: string;
	hasIcons?: boolean;
	hasTrailingText?: boolean;
	accessibilityRole?: string;
	accessibilityLabel?: string;
	children?: ReactNode;
};

export type TableRowGroupTitleProps = {
	title: string;
};

export type TableRowIconProps = {
	source?: number;
	IconComponent?: ComponentType<any>;
	variant?: LiteralUnion<'default' | 'danger' | 'blurple'>;
};

export type RowButtonProps = {
	label?: ReactNode;
	icon?: ReactNode;
	arrow?: boolean;
	disabled?: boolean;
	variant?: LiteralUnion<'primary' | 'secondary'>;
	onPress?: DiscordFunction<void>;
};

/* ------------------------------------------------------------------ *
 * Buttons
 * ------------------------------------------------------------------ */

export type ButtonVariant = LiteralUnion<
	'primary' | 'secondary' | 'tertiary' | 'destructive' | 'active' | 'expressive'
>;
export type ButtonSize = LiteralUnion<'sm' | 'md' | 'lg'>;

export type ButtonProps = {
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
	onPress?: DiscordFunction<void>;
	onPressIn?: DiscordFunction<void>;
	onPressOut?: DiscordFunction<void>;
};

/** `Button` with its attached `Icon` static. */
export type ButtonComponent = ComponentType<ButtonProps> & {
	Icon: ComponentType<TableRowIconProps>;
};

export type IconButtonProps = {
	icon?: ReactNode | number;
	variant?: ButtonVariant;
	size?: ButtonSize;
	loading?: boolean;
	disabled?: boolean;
	label?: string;
	accessibilityLabel?: string;
	style?: StyleProp<ViewStyle>;
	onPress?: DiscordFunction<void>;
};

/** `FloatingActionButton`: a single-icon FAB, typically pinned to a screen corner. */
export type FloatingActionButtonProps = {
	icon?: ReactNode | number;
	style?: StyleProp<ViewStyle>;
	onPress?: DiscordFunction<void>;
};

/* ------------------------------------------------------------------ *
 * Inputs
 * ------------------------------------------------------------------ */

/** Input sizing, shared by the whole `TextField`/`Input` family. */
export type InputSize = LiteralUnion<'sm' | 'md' | 'lg'>;
/** Input status. `focused` is an internal state and is not user-settable. */
export type InputStatus = LiteralUnion<'default' | 'error'>;
/** Icon slot: a rendered node, a component, or a render function. */
export type IconSlot = ReactNode | ComponentType<any> | DiscordFunction<ReactNode>;

/**
 * Discord's form-style `TextInput` (`TextInput.native`), whose `onChange` receives the string value.
 * Props it does not read are spread onto the native input via {@link TextInputPassthrough}.
 */
export type TextInputProps = {
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
} & TextInputPassthrough;

/**
 * Native `TextInput` props forwarded through `TextInput` (`maxLength`, `selectionColor`, `onFocus`, …),
 * minus the members `TextInput` overrides with its own semantics.
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
 * The redesign `TextField` family (`TextArea`, `SearchField`, `GhostInput`, `SplitTextInput`), which
 * owns the `size` / `status` / `leadingIcon` chrome. `onChange` receives the string value.
 */
export type TextFieldProps = {
	value?: string;
	defaultValue?: string;
	placeholder?: string;
	autoFocus?: boolean;
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
	leadingPressableProps?: PressableProps;
	trailingPressableProps?: PressableProps;
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
	onClear?: DiscordFunction<void>;
	onFocus?: RNTextInputProps['onFocus'];
	onBlur?: RNTextInputProps['onBlur'];
};

/** `TextArea` extends the field family with a character limit. */
export type TextAreaProps = {
	maxLength?: number;
} & TextFieldProps;

/** `GhostInput`: a borderless field bridging to the `useTextField` hook. */
export type GhostInputProps = {
	isCentered?: boolean;
	containerStyle?: StyleProp<ViewStyle>;
} & TextFieldProps;

/** `SplitTextInput` / `SplitTextField`: a segmented input (e.g. verification codes). */
export type SplitTextInputProps = {
	isRound?: boolean;
	leadingText?: string;
	leadingPressableProps?: PressableProps;
} & TextFieldProps;

/**
 * The DS `Slider`. It reads only `startIcon` / `endIcon` / `style` / `onValueChange` / `step`; the
 * remaining slider props (`value`, bounds, tint colours) are spread onto the underlying RN slider.
 */
export type SliderProps = {
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
};

export type CheckboxProps = {
	label?: ReactNode;
	description?: ReactNode;
	checked: boolean;
	required?: boolean;
	accessibilityRole?: string;
	accessibilityState?: AccessibilityState;
	onToggle: DiscordFunction<void>;
};

export type SegmentedControlProps = {
	/** The controller returned by `useSegmentedControlState`. */
	state: SegmentedControlState;
	/** @default 'default' */
	variant?: LiteralUnion<'default'>;
	keyboardShouldPersistTaps?: boolean | 'always' | 'never' | 'handled';
};

/** The state controller a `SegmentedControl` is driven by. */
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

/** `SegmentedControlPages`: the swipeable pages driven by a segmented control's state. */
export type SegmentedControlPagesProps = {
	state: SegmentedControlState;
};

/* ------------------------------------------------------------------ *
 * Layout & surfaces
 * ------------------------------------------------------------------ */

export type StackProps = {
	spacing?: number;
	direction?: 'horizontal' | 'vertical';
	align?: 'start' | 'center' | 'end' | 'stretch';
	justify?: 'start' | 'center' | 'end' | 'between' | 'around';
	children?: ReactNode;
} & ViewProps;

export type CardProps = {
	variant?: LiteralUnion<'primary' | 'secondary' | 'muted' | 'transparent'>;
	border?: LiteralUnion<'none' | 'subtle' | 'strong'>;
	shadow?: LiteralUnion<'none' | 'low' | 'medium' | 'high' | 'border'>;
	radius?: number;
	start?: boolean;
	end?: boolean;
	children?: ReactNode;
} & ViewProps;

/* ------------------------------------------------------------------ *
 * Alerts, sheets & menus
 * ------------------------------------------------------------------ */

export type AlertModalProps = {
	title?: ReactNode;
	content?: ReactNode;
	extraContent?: ReactNode;
	actions?: ReactNode;
};

export type AlertActionButtonProps = {
	text: string;
	variant?: ButtonVariant;
	loading?: boolean;
	disabled?: boolean;
	onPress?: DiscordFunction<void>;
};

export type ActionSheetProps = {
	children?: ReactNode;
};

export type ActionSheetRowProps = {
	label: ReactNode;
	subLabel?: ReactNode;
	icon?: ReactNode;
	onPress?: DiscordFunction<void>;
};

/** An entry of a `ContextMenu`. */
export type ContextMenuItem = {
	label: string;
	action: DiscordFunction<void>;
	variant?: LiteralUnion<'default' | 'destructive'>;
	iconSource?: number;
};

/** `ContextMenu`: an anchored popover whose `children` render the trigger from the props it passes. */
export type ContextMenuProps = {
	title?: string;
	items: ContextMenuItem[];
	triggerOnTap?: boolean;
	children: (props: PressableProps) => ReactNode;
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
