import { Discord } from '~/metro/components';

export default Discord.createStyles({
	// Discord's empty state paints the screen's lower background; the page's own shows through instead.
	container: {
		backgroundColor: 'transparent',
	},
});
