import { Discord } from '~/metro/components';

export default Discord.createStyles({
	// TableRow sets its sub-label only a few points under the label; this matches the row's own padding instead.
	control: {
		marginTop: 8,
	},
	disabled: {
		opacity: 0.5,
	},
});
