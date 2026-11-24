import { Discord } from '@unbound-app/api/metro/components';
import { metro } from '@unbound-app/api';

export const PILL_HEIGHT = 24;
const AVATAR_SIZE = 18;

// A factory, so the theme is read when the pill renders rather than when the plugin loads.
export default Discord.createStyles(() => {
	const { Theme } = metro.common;

	return {
		pill: {
			position: 'absolute',
			left: 12,
			zIndex: 10,
			flexDirection: 'row',
			alignItems: 'center',
			gap: 5,
			height: PILL_HEIGHT,
			paddingLeft: 3,
			paddingRight: 8,
			borderRadius: 999,
			backgroundColor: Theme.colors?.BACKGROUND_SURFACE_HIGH,
			borderColor: Theme.colors?.BORDER_SUBTLE,
			borderWidth: 1,
		},
		avatar: { width: AVATAR_SIZE, height: AVATAR_SIZE, borderRadius: 999 },
	};
});
