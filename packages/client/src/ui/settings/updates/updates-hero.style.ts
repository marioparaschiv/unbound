import { Discord } from '~/metro/components';

export default Discord.createStyles({
	hero: {
		alignItems: 'center',
		gap: 14,
		paddingTop: 8,
	},
	text: {
		alignItems: 'center',
		gap: 4,
	},
	centered: {
		textAlign: 'center',
	},
	actions: {
		alignSelf: 'stretch',
		flexDirection: 'row',
		gap: 8,
		marginTop: 2,
	},
	action: {
		flex: 1,
	},
});
