import { assets } from '@unbound-app/api';
import { Image } from 'react-native';

import useStyles from '~/components/permission-icons.style';

type StateIconProps = {
	state: 'allowed' | 'denied';
};

function StateIcon({ state }: StateIconProps) {
	const styles = useStyles();
	const allowed = state === 'allowed';
	const source = assets.getIdByName(allowed ? 'CheckmarkLargeIcon' : 'XLargeIcon');

	return (
		<Image source={source} style={[styles.state, allowed ? styles.allowed : styles.denied]} />
	);
}

export default StateIcon;
