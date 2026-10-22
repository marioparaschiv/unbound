import { Discord } from '~/api/metro/components';

export default Discord.createStyles({
	card: {
		gap: 14,
		padding: 16,
	},
	row: {
		flexDirection: 'row',
		alignItems: 'flex-start',
		gap: 12,
	},
	body: {
		flex: 1,
	},
});
