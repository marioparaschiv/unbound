import { Discord } from '~/metro/components';

export default Discord.createStyles({
	// The caption's own line height, so the taller avatar row overflows it instead of pushing the title and preview up.
	authors: {
		alignSelf: 'center',
		height: 18,
	},
});
