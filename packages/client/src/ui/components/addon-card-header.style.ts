import { Discord } from '~/metro/components';

export default Discord.createStyles({
	container: {
		flexDirection: 'row',
		alignItems: 'flex-start',
		gap: 12,
	},
	content: {
		flex: 1,
		gap: 3,
	},
	description: {
		marginTop: 5,
		lineHeight: 19,
	},
});
