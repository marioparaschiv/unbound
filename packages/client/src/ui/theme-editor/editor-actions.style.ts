import { Discord } from '~/metro/components';

export default Discord.createStyles({
	// Discord's Stack sets `width: '100%'`; in the header it would cover the back button and title.
	actions: {
		width: 'auto',
	},
});
