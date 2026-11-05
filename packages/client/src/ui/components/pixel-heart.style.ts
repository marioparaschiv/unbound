import { Discord } from '~/metro/components';

export default Discord.createStyles({
	edge: {
		position: 'absolute',
	},
	// The two faces hide when turned away.
	face: {
		backfaceVisibility: 'hidden',
	},
});
