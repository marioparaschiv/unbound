import { Animated, StyleSheet, View } from 'react-native';

import { SVG } from '~/metro/common';

import { HEART_COLUMNS, HEART_EDGE, HEART_PIXELS, HEART_ROWS } from './pixel-heart-pixels';
import usePixelHeartMotion from './use-pixel-heart-motion';
import PixelHeartLayer from './pixel-heart-layer';

/** The glint's width in heart pixels. */
const GLINT_WIDTH = 3;

/** The heart is a little thicker than a Minecraft item's one pixel; its body is sliced densely enough to read as solid. */
const HALF_THICKNESS = 0.8;
// About half a point apart at 84pt: any sparser and the stepped outline shows as separate sheets near side-on.
const SLICES = Array.from({ length: 24 }, (_, index) => -0.96 + (index * 1.92) / 23);

/** One turn sampled finely enough that the slices' sideways drift follows a sine. */
const TURN = Array.from({ length: 17 }, (_, index) => index / 16);
const SINE = TURN.map((turn) => Math.sin(turn * Math.PI * 2));

type PixelHeartProps = {
	/** The heart's width in points; its height follows the pixel grid. */
	size: number;
};

/**
 * @description A pastel-red pixel-art heart extruded like a Minecraft item and spinning. The trick: flat
 * slices spin together, each drifting sideways by its depth times the sine of the angle, so the body shows
 * edge-on; the two faces hide when turned away.
 */
function PixelHeart({ size }: PixelHeartProps) {
	const { spin, glintRef } = usePixelHeartMotion(-GLINT_WIDTH * 2, HEART_COLUMNS + GLINT_WIDTH);
	const height = (size / HEART_COLUMNS) * HEART_ROWS;
	const depth = (size / HEART_COLUMNS) * HALF_THICKNESS;

	function slice(at: number, turnedBy = 0) {
		const rotateY = spin.interpolate({
			inputRange: [0, 1],
			outputRange: [`${turnedBy}deg`, `${turnedBy + 360}deg`],
		});
		const translateX = spin.interpolate({
			inputRange: TURN,
			outputRange: SINE.map((sine) => sine * depth * at),
		});

		// No perspective: each slice would foreshorten differently and the stack would shimmer.
		return [StyleSheet.absoluteFill, { transform: [{ translateX }, { rotateY }] }];
	}

	// Each face hides once it turns away, so only the one facing the viewer is drawn over the body.
	function face(at: number, turnedBy: number) {
		return [slice(at, turnedBy), { backfaceVisibility: 'hidden' as const }];
	}

	// Side-on, every slice is a zero-width line that blinks in and out; a flat edge covers them there.
	const edgeOpacity = spin.interpolate({
		inputRange: [0, 0.235, 0.25, 0.265, 0.735, 0.75, 0.765, 1],
		outputRange: [0, 0, 1, 0, 0, 1, 0, 0],
	});

	return (
		<View style={{ width: size, height }}>
			{SLICES.map((at) => (
				<Animated.View key={at} style={slice(at)}>
					<PixelHeartLayer size={size} side />
				</Animated.View>
			))}
			<Animated.View
				style={{
					position: 'absolute',
					left: size / 2 - depth,
					width: depth * 2,
					height,
					opacity: edgeOpacity,
				}}
			>
				<SVG.Svg
					width={depth * 2}
					height={height}
					viewBox={`0 0 1 ${HEART_ROWS}`}
					preserveAspectRatio='none'
				>
					{HEART_EDGE.map(({ y, color }) => (
						<SVG.Rect key={y} x={0} y={y} width={1} height={1.02} fill={color} />
					))}
				</SVG.Svg>
			</Animated.View>
			<Animated.View style={face(-1, 180)}>
				<PixelHeartLayer size={size} />
			</Animated.View>
			<Animated.View style={face(1, 0)}>
				<PixelHeartLayer size={size} />
				<SVG.Svg
					width={size}
					height={height}
					viewBox={`0 0 ${HEART_COLUMNS} ${HEART_ROWS}`}
					style={StyleSheet.absoluteFill}
				>
					<SVG.Defs>
						<SVG.ClipPath id='heart'>
							{HEART_PIXELS.map(({ x, y }) => (
								<SVG.Rect key={`${x},${y}`} x={x} y={y} width={1} height={1} />
							))}
						</SVG.ClipPath>
					</SVG.Defs>
					<SVG.G clipPath='url(#heart)'>
						<SVG.Rect
							ref={glintRef}
							x={-GLINT_WIDTH * 2}
							y={0}
							width={GLINT_WIDTH}
							height={HEART_ROWS}
							fill='#FFFFFF'
							fillOpacity={0.45}
							transform='skewX(-20)'
						/>
					</SVG.G>
				</SVG.Svg>
			</Animated.View>
		</View>
	);
}

export default PixelHeart;
