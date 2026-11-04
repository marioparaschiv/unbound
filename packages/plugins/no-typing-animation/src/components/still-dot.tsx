import { createElement, type ComponentType } from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';

import useStyles from '~/components/still-dot.style';
import { StillDotsRunning } from '~/modules';

type StillDotProps = {
	animated: ComponentType<Record<string, unknown>>;
	dotStyle?: StyleProp<ViewStyle>;
	[prop: string]: unknown;
};

function StillDot({ animated, ...props }: StillDotProps) {
	const styles = useStyles();

	if (!StillDotsRunning.useRunning()) return createElement(animated, props);

	return <View style={[styles.dot, props.dotStyle]} />;
}

export default StillDot;
