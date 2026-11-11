import { Discord } from '~/metro/components';

export default Discord.createStyles({
	// Each divider pulls itself up by Discord's 1 point divider width over the row above. The body overlaps the
	// header by as much, so the first divider is not clipped and the header shows beside its inset.
	body: {
		overflow: 'hidden',
		marginTop: -1,
	},
	// Laid out at its natural height whatever the body's animated height, so it can be measured.
	rows: {
		position: 'absolute',
		top: 0,
		paddingTop: 1,
		left: 0,
		right: 0,
	},
});
