import { Discord } from '@unbound-app/api/metro/components';
import { metro } from '@unbound-app/api';

import { STILL_DOT_OPACITY } from '~/lib/constants';

export default Discord.createStyles(() => ({
	dot: {
		backgroundColor: metro.common.Theme.colors?.TEXT_DEFAULT,
		borderRadius: 3,
		marginRight: 2,
		height: 6,
		width: 6,
		opacity: STILL_DOT_OPACITY,
	},
}));
