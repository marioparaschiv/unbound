import { Discord } from '~/metro/components';

// The layout of Discord's `TableSliderRow`, which this row draws when it also shows a sub-label.
export default Discord.createStyles({
	header: {
		flexDirection: 'row',
		flexWrap: 'wrap',
		justifyContent: 'space-between',
		alignItems: 'center',
	},
	label: {
		flexShrink: 1,
	},
	slider: {
		marginStart: -4,
		marginTop: 8,
	},
});
