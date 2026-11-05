import type { DesignModule } from '@unbound-app/types/components';
import type { ComponentProps } from 'react';
import { View } from 'react-native';

import useStyles from './fallback-card.style';

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
	const styles = useStyles();

	return (
		<View
			{...rest}
			style={[
				styles.card,
				typeof radius === 'number' ? { borderRadius: radius } : null,
				style,
			]}
		>
			{children}
		</View>
	);
}

export default FallbackCard;
