import type { DesignModule } from '@unbound-app/types/components';
import type { FlexAlignType, ViewStyle } from 'react-native';
import type { ComponentProps } from 'react';
import { View } from 'react-native';

type StackProps = ComponentProps<DesignModule['Stack']>;

type JustifyContent = NonNullable<ViewStyle['justifyContent']>;

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

function isJustifyContent(value: string): value is JustifyContent {
	return (JUSTIFY_CONTENT as readonly string[]).includes(value);
}

/**
 * @description Unbound's stand-in for Discord's `Stack`: a view laying its children out with even spacing.
 * Like Discord's, `align` and `justify` are the flexbox values themselves.
 * @param props The stack props.
 * @returns The stack element.
 */
function FallbackStack({
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

export default FallbackStack;
