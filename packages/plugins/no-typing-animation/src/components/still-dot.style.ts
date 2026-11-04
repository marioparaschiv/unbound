import { Discord } from '@unbound-app/api/metro/components';

import { STILL_DOT_OPACITY } from '~/constants';
import { Theme } from '~/modules';

export default Discord.createStyles(() => ({
	dot: {
		backgroundColor: Theme.colors?.TEXT_DEFAULT,
		borderRadius: 3,
		marginRight: 2,
		height: 6,
		width: 6,
		opacity: STILL_DOT_OPACITY,
	},
}));
