import { Discord } from '~/metro/components';

export default Discord.createStyles({
	// Clips the unit row's top padding so it sits under the amount; no divider sits between them. Clipping, not
	// overlapping, because row backgrounds are translucent and an overlap draws a lighter band.
	unit: {
		overflow: 'hidden',
	},
	unitRow: {
		marginTop: -12,
	},
});
