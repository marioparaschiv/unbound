import { View } from 'react-native';

import useStyles from './styles';
import info from './info';


export default function Progress({ step }: { step: number; }) {
	const styles = useStyles();

	return <View style={{ width: '50%' }}>
		<View
			style={[{
				width: '100%',
				height: 6,
				borderRadius: 999,
			}, styles.progressInactive]}
		/>
		<View
			style={[{
				width: `${step / (info.length - 1) * 100}%`,
				height: 6,
				borderRadius: 999,
				position: 'absolute',
				left: 0
			}, styles.progressActive]}
		/>
	</View>;
}