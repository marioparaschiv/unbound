import { Discord } from '@unbound-app/api/metro/components';
import { metro } from '@unbound-app/api';

export default Discord.createStyles(() => {
	const { Theme } = metro.common;
	const mobile = Theme.modules?.mobile;
	const size = mobile?.CHAT_INPUT_ACTION_ICON_PIXEL_SIZE ?? 20;

	return {
		button: {
			width: mobile?.CHAT_INPUT_ACTION_BUTTON_SIZE ?? 32,
			height: mobile?.CHAT_INPUT_ACTION_BUTTON_SIZE ?? 32,
			alignItems: 'center',
			justifyContent: 'center',
		},
		icon: {
			width: size,
			height: size,
			tintColor: Theme.colors?.CHAT_INPUT_ACTION_BUTTON_ICON_DEFAULT_TINT,
		},
		iconActive: {
			width: size,
			height: size,
			tintColor: Theme.colors?.TEXT_BRAND,
		},
	};
});
