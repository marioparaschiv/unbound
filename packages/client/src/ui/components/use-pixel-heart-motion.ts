import { useEffect, useRef, useState } from 'react';
import { Animated, Easing } from 'react-native';

import useReducedMotion from '~/ui/hooks/use-reduced-motion';

/** The glint rect's props that change each frame. */
type GlintProps = { x: number };

/** The glint rect's native handle; react-native-svg shapes take position updates through it. */
type GlintHandle = { setNativeProps: (props: GlintProps) => void };

/**
 * @description The pixel heart's motion: a slow coin-like spin and a glint that sweeps across it. Both
 * stay still when Discord's reduced motion is on.
 * @param from The glint's x before a sweep, in heart pixels.
 * @param to The glint's x after a sweep, in heart pixels.
 * @returns The spin (0 to 1 per turn) and the ref to put on the glint's rect.
 */
function usePixelHeartMotion(from: number, to: number) {
	const reduced = useReducedMotion();
	const [spin] = useState(() => new Animated.Value(0));
	const [glint] = useState(() => new Animated.Value(0));
	const glintRef = useRef<GlintHandle>(null);

	useEffect(() => {
		if (reduced) return;

		// The glint moves an SVG attribute, so it is set on the shape each frame instead of through the native driver.
		const listener = glint.addListener(({ value }) => {
			glintRef.current?.setNativeProps({ x: from + (to - from) * value });
		});

		const loops = [
			Animated.loop(
				Animated.timing(spin, {
					toValue: 1,
					duration: 3200,
					easing: Easing.linear,
					useNativeDriver: true,
				}),
			),
			Animated.loop(
				Animated.sequence([
					Animated.timing(glint, {
						toValue: 1,
						duration: 900,
						easing: Easing.inOut(Easing.quad),
						useNativeDriver: false,
					}),
					Animated.delay(1400),
					Animated.timing(glint, { toValue: 0, duration: 0, useNativeDriver: false }),
				]),
			),
		];

		for (const loop of loops) loop.start();

		return () => {
			glint.removeListener(listener);

			for (const loop of loops) loop.stop();
		};
	}, [reduced, from, to]);

	return { spin, glintRef };
}

export default usePixelHeartMotion;
