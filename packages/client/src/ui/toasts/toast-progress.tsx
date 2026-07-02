import Animated, { type SharedValue } from 'react-native-reanimated';
import { memo } from 'react';

import useStyles from './toast.style';

type ToastProgressProps = {
	width: SharedValue<number>;
};

function ToastProgress({ width }: ToastProgressProps) {
	const styles = useStyles();
	return <Animated.View style={[styles.progressBar, { width }, styles.bar]} />;
}

export default memo(ToastProgress);
