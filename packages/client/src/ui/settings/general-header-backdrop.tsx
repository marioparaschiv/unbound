import type { LayoutChangeEvent } from 'react-native';
import { StyleSheet, View } from 'react-native';
import { useState } from 'react';

import { SVG } from '~/metro/common';

/**
 * @description The banner's background: a neutral graphite falling from light to ink, under the website's
 * tilted dot grid (`.dotted-bg`: 16pt pitch, r=1.6, 35°) that fades out downward, and a lit top edge.
 */
function GeneralHeaderBackdrop() {
	// The SVG is sized in points: percentage sizes resolve against the wrong box inside the banner.
	const [size, setSize] = useState({ width: 0, height: 0 });
	const { width, height } = size;

	function measure({ nativeEvent }: LayoutChangeEvent) {
		setSize({ width: nativeEvent.layout.width, height: nativeEvent.layout.height });
	}

	return (
		<View style={StyleSheet.absoluteFill} onLayout={measure} pointerEvents='none'>
			{width ? (
				<SVG.Svg width={width} height={height}>
					<SVG.Defs>
						<SVG.LinearGradient id='graphite' x1='0' y1='0' x2='0' y2='1'>
							<SVG.Stop offset='0' stopColor='#1E1E22' />
							<SVG.Stop offset='1' stopColor='#0B0B0D' />
						</SVG.LinearGradient>
						<SVG.Pattern
							id='dots'
							width={16}
							height={16}
							patternUnits='userSpaceOnUse'
							patternTransform='rotate(35)'
						>
							<SVG.Circle cx={12} cy={12} r={1.6} fill='#FFFFFF' />
						</SVG.Pattern>
						<SVG.LinearGradient id='fade' x1='0' y1='0' x2='0' y2='1'>
							<SVG.Stop offset='0' stopColor='#FFFFFF' stopOpacity={0.16} />
							<SVG.Stop offset='0.8' stopColor='#FFFFFF' stopOpacity={0} />
						</SVG.LinearGradient>
						<SVG.Mask id='fadeMask'>
							<SVG.Rect width={width} height={height} fill='url(#fade)' />
						</SVG.Mask>
					</SVG.Defs>
					<SVG.Rect width={width} height={height} fill='url(#graphite)' />
					<SVG.Rect
						width={width}
						height={height}
						fill='url(#dots)'
						mask='url(#fadeMask)'
					/>
					<SVG.Rect width={width} height={1} fill='#FFFFFF' fillOpacity={0.1} />
				</SVG.Svg>
			) : null}
		</View>
	);
}

export default GeneralHeaderBackdrop;
