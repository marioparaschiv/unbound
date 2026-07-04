import { Discord } from '~/api/metro/components';

export default Discord.createStyles({
	container: {
		flex: 1,
		alignItems: 'center',
		justifyContent: 'center',
		gap: 12,
		padding: 32,
	},
	image: {
		width: '80%',
		resizeMode: 'contain',
	},
});
