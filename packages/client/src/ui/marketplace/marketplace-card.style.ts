import { Discord } from '~/api/metro/components';

export default Discord.createStyles({
	card: {
		gap: 14,
		padding: 16,
	},
	footer: {
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'space-between',
		gap: 12,
		minHeight: 32,
	},
	meta: {
		flexShrink: 1,
	},
});
