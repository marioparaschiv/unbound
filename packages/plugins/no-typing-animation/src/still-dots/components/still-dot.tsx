import { View, type StyleProp, type ViewStyle } from 'react-native';

import useStyles from '~/still-dots/components/still-dot.style';

type StillDotProps = {
	dotStyle?: StyleProp<ViewStyle>;
	[prop: string]: unknown;
};

function StillDot(props: StillDotProps) {
	const styles = useStyles();

	return <View style={[styles.dot, props.dotStyle]} />;
}

export default StillDot;
