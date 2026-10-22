import { Discord } from '~/api/metro/components';

export default Discord.createStyles({
	container: {
		flexDirection: 'row',
		alignItems: 'center',
		alignSelf: 'flex-start',
		gap: 6,
	},
	pressed: {
		opacity: 0.6,
	},
	names: {
		flexShrink: 1,
	},
});
