import { Discord } from '~/api/metro/components';

export default Discord.createStyles({
	container: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: 8,
		paddingVertical: 10,
		paddingHorizontal: 12,
		borderWidth: 1,
	},
	text: {
		flex: 1,
	},
	button: {
		marginLeft: 4,
	},
});
