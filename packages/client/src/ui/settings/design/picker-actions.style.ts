import { Discord } from '~/metro/components';

export default Discord.createStyles({
	spacer: {
		flex: 1,
	},
	// The picker's theme name and caption: two 18pt lines 5pt apart, ending at the safe area.
	// The buttons centre on that block and overhang it equally.
	bar: {
		height: 41,
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'space-between',
		paddingHorizontal: 20,
	},
});
