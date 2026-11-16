import { Discord } from '~/metro/components';

export default Discord.createStyles({
	card: {
		gap: 10,
		padding: 18,
	},
	body: {
		lineHeight: 19,
	},
	actions: {
		flexDirection: 'row',
		gap: 8,
		marginTop: 4,
	},
	action: {
		flex: 1,
	},
});
