import type { DesignModule } from '@unbound-app/types/components';
import type { FlexAlignType, ViewStyle } from 'react-native';
import { Switch, Text, View } from 'react-native';
import type { ComponentProps } from 'react';

type TextProps = ComponentProps<DesignModule['Text']>;
type SwitchProps = ComponentProps<DesignModule['FormSwitch']>;
type StackProps = ComponentProps<DesignModule['Stack']>;
type CardProps = ComponentProps<DesignModule['Card']>;

type JustifyContent = NonNullable<ViewStyle['justifyContent']>;
type EllipsizeMode = NonNullable<ComponentProps<typeof Text>['ellipsizeMode']>;

const ELLIPSIZE_MODES: readonly EllipsizeMode[] = ['head', 'middle', 'tail', 'clip'];

const ALIGN_ITEMS: readonly FlexAlignType[] = [
	'flex-start',
	'flex-end',
	'center',
	'stretch',
	'baseline',
];

const JUSTIFY_CONTENT: readonly JustifyContent[] = [
	'flex-start',
	'flex-end',
	'center',
	'space-between',
	'space-around',
	'space-evenly',
];

function isAlignItems(value: string): value is FlexAlignType {
	return (ALIGN_ITEMS as readonly string[]).includes(value);
}

function isEllipsizeMode(value: TextProps['ellipsizeMode']): value is EllipsizeMode {
	return typeof value === 'string' && (ELLIPSIZE_MODES as readonly string[]).includes(value);
}

function isJustifyContent(value: string): value is JustifyContent {
	return (JUSTIFY_CONTENT as readonly string[]).includes(value);
}

/**
 * @description Unbound's stand-in for Discord's `Text`: plain React Native text with the same text props.
 * @param props The text props.
 * @returns The text element.
 */
export function FallbackText({
	children,
	style,
	numberOfLines,
	lineClamp,
	ellipsizeMode,
	allowFontScaling,
}: TextProps) {
	const lines = numberOfLines ?? lineClamp;

	return (
		<Text
			style={style}
			numberOfLines={typeof lines === 'number' ? lines : undefined}
			ellipsizeMode={isEllipsizeMode(ellipsizeMode) ? ellipsizeMode : undefined}
			allowFontScaling={typeof allowFontScaling === 'boolean' ? allowFontScaling : undefined}
		>
			{children}
		</Text>
	);
}

/**
 * @description Unbound's stand-in for Discord's `Heading`: bold React Native text.
 * @param props The text props.
 * @returns The heading element.
 */
export function FallbackHeading(props: TextProps) {
	return <FallbackText {...props} style={[{ fontWeight: '700' }, props.style]} />;
}

/**
 * @description Unbound's stand-in for Discord's `FormSwitch`: React Native's switch.
 * @param props The switch props.
 * @returns The switch element.
 */
export function FallbackSwitch({
	value,
	disabled,
	accessibilityLabel,
	onValueChange,
}: SwitchProps) {
	return (
		<Switch
			value={value === true}
			disabled={disabled ?? undefined}
			accessibilityLabel={
				typeof accessibilityLabel === 'string' ? accessibilityLabel : undefined
			}
			onValueChange={(next) => void onValueChange?.(next)}
		/>
	);
}

/**
 * @description Unbound's stand-in for Discord's `Stack`: a view laying its children out with even spacing.
 * Like Discord's, `align` and `justify` are the flexbox values themselves.
 * @param props The stack props.
 * @returns The stack element.
 */
export function FallbackStack({
	spacing = 8,
	direction = 'vertical',
	align = 'stretch',
	justify = 'flex-start',
	style,
	children,
	onLayout,
}: StackProps) {
	return (
		<View
			onLayout={onLayout}
			style={[
				{
					width: '100%',
					flexDirection: direction === 'horizontal' ? 'row' : 'column',
					gap: spacing,
					alignItems: isAlignItems(align) ? align : undefined,
					justifyContent: isJustifyContent(justify) ? justify : undefined,
				},
				style,
			]}
		>
			{children}
		</View>
	);
}

/**
 * @description Unbound's stand-in for Discord's `Card`: a padded, rounded view.
 * @param props The card props.
 * @returns The card element.
 */
export function FallbackCard({
	radius,
	style,
	children,
	variant: _variant,
	border: _border,
	shadow: _shadow,
	start: _start,
	end: _end,
	onPress: _onPress,
	accessibilityRole: _accessibilityRole,
	...rest
}: CardProps) {
	return (
		<View
			{...rest}
			style={[
				{
					padding: 16,
					borderRadius: typeof radius === 'number' ? radius : 16,
					overflow: 'hidden',
				},
				style,
			]}
		>
			{children}
		</View>
	);
}
