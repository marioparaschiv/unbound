import { ReactNative as RN } from '@metro/common';
import useStyles from '../styles';
import info from '../info';

export default function Progress({ step }: { step: number }) {
	const styles = useStyles();

	return <RN.View style={{ width: '50%' }}>
		<RN.View
			style={[{
				width: '100%',
				height: 6,
				borderRadius: 999,
			}, styles.progressInactive]}
		/>
		<RN.View
			style={[{
				width: `${step / (info.length - 1) * 100}%`,
				height: 6,
				borderRadius: 999,
				position: 'absolute',
				left: 0
			}, styles.progressActive]}
		/>
	</RN.View>;
}