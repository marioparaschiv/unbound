import { Discord } from '@api/metro/components';


const useStyles = Discord.createStyles({
	touchable: {
		marginRight: 10
	},
	container: {
		flex: 1,
		padding: 16,
		paddingBottom: 0,
		gap: 12
	},
	listEnd: {
		marginBottom: 25
	}
});

export default useStyles;