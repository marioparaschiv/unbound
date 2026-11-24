import { Discord } from '@unbound-app/api/metro/components';
import { metro } from '@unbound-app/api';

const EMOJI_SIZE = 18;

// A factory, so the theme is read when the sheet renders rather than when the plugin loads.
export default Discord.createStyles(() => {
	const { Theme } = metro.common;

	return {
		row: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
		pill: {
			alignItems: 'center',
			backgroundColor: Theme.colors?.BACKGROUND_MOD_SUBTLE,
			borderColor: Theme.colors?.BORDER_SUBTLE,
			borderRadius: Theme.radii?.sm,
			borderWidth: 1,
			height: 30,
			justifyContent: 'center',
			minWidth: 38,
			paddingHorizontal: 8,
		},
		image: { height: EMOJI_SIZE, width: EMOJI_SIZE },
	};
});
