import { Discord } from '@api/metro/components';


export default Discord.createStyles({
	container: {
		margin: 20
	},
	card: {
		flexDirection: 'column'
	},
	header: {
		flexDirection: 'row',
		gap: 4,
		justifyContent: 'space-between',
		alignItems: 'center'
	}
});