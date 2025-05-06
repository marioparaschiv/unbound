import { Discord } from '@api/metro/components';


export default Discord.createStyles({
	empty: {
		justifyContent: 'center',
		alignItems: 'center',
		flex: 1
	},

	emptyImage: {
		marginBottom: 10,
		height: '50%',
		aspectRatio: 1,
	},

	emptyMessage: {
		textAlign: 'center',
		paddingHorizontal: 25
	}
});