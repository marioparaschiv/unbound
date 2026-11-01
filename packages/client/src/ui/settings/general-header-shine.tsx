import type { ComponentProps } from 'react';
import { Animated } from 'react-native';

import { SVG } from '~/metro/common';

import useStyles, { SHINE_HEIGHT, SHINE_WIDTH } from './general-header.style';

type GeneralHeaderShineProps = {
	/** The sweep's animated transform. */
	style: ComponentProps<typeof Animated.View>['style'];
};

/**
 * @description A soft band of light that sweeps across the banner, fading in and out at its edges.
 */
function GeneralHeaderShine({ style }: GeneralHeaderShineProps) {
	const styles = useStyles();

	return (
		<Animated.View pointerEvents='none' style={[styles.shine, style]}>
			<SVG.Svg width={SHINE_WIDTH} height={SHINE_HEIGHT}>
				<SVG.Defs>
					<SVG.LinearGradient id='shine' x1='0' y1='0' x2='1' y2='0'>
						<SVG.Stop offset='0' stopColor='#FFFFFF' stopOpacity={0} />
						<SVG.Stop offset='0.5' stopColor='#FFFFFF' stopOpacity={0.1} />
						<SVG.Stop offset='1' stopColor='#FFFFFF' stopOpacity={0} />
					</SVG.LinearGradient>
				</SVG.Defs>
				<SVG.Rect width={SHINE_WIDTH} height={SHINE_HEIGHT} fill='url(#shine)' />
			</SVG.Svg>
		</Animated.View>
	);
}

export default GeneralHeaderShine;
