import { Discord } from '~/metro/components';

// Discord's `IconButton` takes its corner radius from the theme's button token; its `pillStyle` overrides it.
export default Discord.createStyles({
	pill: {
		borderRadius: 999,
	},
});
