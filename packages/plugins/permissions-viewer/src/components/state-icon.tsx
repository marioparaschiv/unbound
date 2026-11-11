import { Discord } from '@unbound-app/api/metro/components';
import { assets } from '@unbound-app/api';
import { Image } from 'react-native';

import { ALLOWED_COLOR, DENIED_COLOR } from '~/lib/constants';

type StateIconProps = {
	state: 'allowed' | 'denied';
};

function StateIcon({ state }: StateIconProps) {
	const allowed = state === 'allowed';
	const color = allowed ? ALLOWED_COLOR : DENIED_COLOR;
	const source = assets.getIdByName(allowed ? 'CheckmarkLargeIcon' : 'XLargeIcon');

	if (source == null) {
		return <Discord.Text style={{ color, width: 20 }}>{allowed ? '✓' : '✕'}</Discord.Text>;
	}

	return <Image source={source} style={{ height: 20, tintColor: color, width: 20 }} />;
}

export default StateIcon;
