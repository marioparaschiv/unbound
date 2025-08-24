import { Discord } from '@api/metro/components';


export default Discord.createStyles({
	container: {
		// margin: 20
	},
	card: {
		flexDirection: 'column',
		gap: 6,
	},
	header: {
		flexDirection: 'row',
		gap: 4,
		justifyContent: 'space-between',
		alignItems: 'center'
	},
	actions: {
		flexDirection: 'row',
		gap: 8,
		alignItems: 'center'
	},
	authors: {
		flexDirection: 'row',
		gap: 4,
		alignItems: 'center',
	}
});