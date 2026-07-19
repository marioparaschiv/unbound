import { Discord } from '~/api/metro/components';

export default Discord.createStyles({
	container: {
		flex: 1,
		padding: 16,
		gap: 12,
	},
	search: {
		flexGrow: 0,
		flexShrink: 0,
	},
	thumbnail: {
		width: 24,
		height: 24,
	},
});
