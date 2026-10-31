import type { DesignModule } from '@unbound-app/types/components';
import type { ComponentProps } from 'react';
import { View } from 'react-native';

type CardProps = ComponentProps<DesignModule['Card']>;

/**
 * @description Unbound's stand-in for Discord's `Card`: a padded, rounded view.
 * @param props The card props.
 * @returns The card element.
 */
function FallbackCard({
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

export default FallbackCard;
