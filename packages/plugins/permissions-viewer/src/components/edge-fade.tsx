import { metro } from '@unbound-app/api';
import { View } from 'react-native';

import useStyles from '~/components/edge-fade.style';

type EdgeFadeProps = {
	side: 'start' | 'end';
	visible: boolean;
};

function EdgeFade({ side, visible }: EdgeFadeProps) {
	const styles = useStyles();

	if (!visible) return null;

	const { SVG } = metro.common;
	const id = `permissions-viewer-fade-${side}`;
	const color = styles.sheet.color;

	return (
		<View
			pointerEvents='none'
			style={[styles.fade, side === 'start' ? styles.start : styles.end]}
		>
			<SVG.Svg width='100%' height='100%'>
				<SVG.Defs>
					<SVG.LinearGradient id={id} x1='0' y1='0' x2='1' y2='0'>
						<SVG.Stop
							offset='0'
							stopColor={color}
							stopOpacity={side === 'start' ? 1 : 0}
						/>
						<SVG.Stop
							offset='1'
							stopColor={color}
							stopOpacity={side === 'start' ? 0 : 1}
						/>
					</SVG.LinearGradient>
				</SVG.Defs>
				<SVG.Rect x='0' y='0' width='100%' height='100%' fill={`url(#${id})`} />
			</SVG.Svg>
		</View>
	);
}

export default EdgeFade;
