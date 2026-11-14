import { Discord } from '~/metro/components';

export default Discord.createStyles({
	// Matches the no-addons page, so every empty page centres its badge and text the same way.
	container: {
		flex: 1,
		alignItems: 'center',
		justifyContent: 'center',
		gap: 16,
		paddingHorizontal: 24,
		paddingVertical: 32,
	},
	text: {
		textAlign: 'center',
	},
});
