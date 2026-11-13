import { Discord } from '@unbound-app/api/metro/components';
import { metro } from '@unbound-app/api';

import { Button } from '~/lib/constants';

export default Discord.createStyles(() => {
	const { Theme } = metro.common;
	const mobile = Theme.modules?.mobile;
	const size = mobile?.CHAT_INPUT_ACTION_BUTTON_SIZE ?? Button.size;
	const iconSize = mobile?.CHAT_INPUT_ACTION_ICON_PIXEL_SIZE ?? Button.iconSize;

	return {
		button: {
			width: size,
			height: size,
			borderRadius: Theme.radii?.sm,
			alignItems: 'center',
			justifyContent: 'center',
		},
		icon: {
			width: iconSize,
			height: iconSize,
			tintColor: Theme.colors?.CHAT_INPUT_ACTION_BUTTON_ICON_DEFAULT_TINT,
		},
	};
});
