import { Discord } from '~/metro/components';

export default Discord.createStyles({
	icon: {
		width: '100%',
		height: '100%',
	},
	// Every copy covers the icon's box, so the offsets alone spread them.
	copy: {
		position: 'absolute',
		top: 0,
		left: 0,
		width: '100%',
		height: '100%',
	},
});
