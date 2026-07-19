import { Discord } from '~/api/metro/components';

export default Discord.createStyles({
	card: {
		gap: 12,
		padding: 12,
	},
	row: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: 12,
	},
	body: {
		flex: 1,
	},
	trailing: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: 8,
	},
	failed: {
		opacity: 0.5,
	},
	error: {
		marginTop: 4,
	},
});
