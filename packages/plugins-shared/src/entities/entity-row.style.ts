import { Discord } from '@unbound-app/api/metro/components';

export default Discord.createStyles({
	// A server icon is a rounded square in Discord's lists, at the small avatar's size.
	guildIcon: {
		width: 24,
		height: 24,
		borderRadius: 8,
	},
});
