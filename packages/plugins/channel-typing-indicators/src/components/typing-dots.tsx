import { Animated, Easing, View } from 'react-native';
import { useEffect, useMemo, useRef } from 'react';

import useStyles from './typing-dots.style';

// Discord's staggered three-dot wave: each dot pulses in size and opacity on a 2.4-second cycle.
function TypingDots() {
	const styles = useStyles();
	const phase = useRef(new Animated.Value(2.8)).current;
	const waves = useMemo(
		() => [0, 1, 2].map((index) => Animated.modulo(Animated.add(phase, -index * 0.25), 2)),
		[phase],
	);
	const inputRange = [0, 0.4, 0.8, 1, 1.2, 1.6, 2];

	useEffect(() => {
		const animation = Animated.loop(
			Animated.timing(phase, {
				toValue: 6.8,
				duration: 2400,
				easing: Easing.linear,
				useNativeDriver: true,
			}),
		);

		animation.start();

		return () => animation.stop();
	}, [phase]);

	return (
		<View style={styles.container}>
			{waves.map((wave, index) => (
				<Animated.View
					key={index}
					style={[
						styles.dot,
						{
							marginRight: index < 2 ? 1.5 : 0,
							opacity: wave.interpolate({
								inputRange,
								outputRange: [0.3, 0.3, 1, 1, 1, 0.3, 0.3],
							}),
							transform: [
								{
									scale: wave.interpolate({
										inputRange,
										outputRange: [0.8, 0.8, 1, 1, 1, 0.8, 0.8],
									}),
								},
							],
						},
					]}
				/>
			))}
		</View>
	);
}

export default TypingDots;
