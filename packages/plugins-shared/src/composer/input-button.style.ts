import { Discord } from '@unbound-app/api/metro/components';
import { metro } from '@unbound-app/api';

export default Discord.createStyles(() => {
	const { Theme } = metro.common;
	const mobile = Theme.modules?.mobile;

	return {
		button: {
			width: mobile?.CHAT_INPUT_ACTION_BUTTON_SIZE ?? 32,
			height: mobile?.CHAT_INPUT_ACTION_BUTTON_SIZE ?? 32,
			borderRadius: Theme.radii?.sm,
			alignItems: 'center',
			justifyContent: 'center',
		},
		icon: {
			width: mobile?.CHAT_INPUT_ACTION_ICON_PIXEL_SIZE ?? 20,
			height: mobile?.CHAT_INPUT_ACTION_ICON_PIXEL_SIZE ?? 20,
			tintColor: Theme.colors?.CHAT_INPUT_ACTION_BUTTON_ICON_DEFAULT_TINT,
		},
	};
});
