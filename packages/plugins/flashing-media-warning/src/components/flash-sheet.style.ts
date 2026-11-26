import { Discord } from '@unbound-app/api/metro/components';
import { metro } from '@unbound-app/api';

export const BAR_HEIGHT = 48;

export default Discord.createStyles(() => {
	const { Theme } = metro.common;

	return {
		body: { gap: 16, paddingHorizontal: 16, paddingBottom: 16 },
		status: { gap: 12, padding: 16, alignItems: 'center' },
		timeline: { flexDirection: 'row', alignItems: 'flex-end', height: BAR_HEIGHT, gap: 1 },
		bar: { flex: 1, borderRadius: 1, backgroundColor: Theme.colors.INTERACTIVE_ICON_DEFAULT },
		barCurrent: { backgroundColor: Theme.colors.BACKGROUND_BRAND },
		frame: { width: '100%', height: 260, borderRadius: Theme.radii?.sm },
		stepper: {
			flexDirection: 'row',
			alignItems: 'center',
			justifyContent: 'space-between',
		},
	};
});
