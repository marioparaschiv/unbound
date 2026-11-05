import { Discord } from '~/metro/components';

export default Discord.createStyles({
	frame: {
		flex: 1,
	},
	tabs: {
		position: 'absolute',
		left: 0,
		right: 0,
		// The picker's preview card adds its own gap below, so this evens the space either side.
		paddingHorizontal: 16,
		paddingTop: 16,
		paddingBottom: 8,
	},
});
