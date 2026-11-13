import { Discord } from '@unbound-app/api/metro/components';
import { metro } from '@unbound-app/api';

export default Discord.createStyles(() => {
	const { Theme } = metro.common;

	return {
		card: {
			backgroundColor: Theme.colors?.BACKGROUND_SURFACE_HIGH,
			borderRadius: Theme.radii?.lg,
			paddingVertical: 12,
			maxHeight: '70%',
		},
		title: { paddingHorizontal: 14, paddingBottom: 10 },
		error: { paddingHorizontal: 14 },
	};
});
