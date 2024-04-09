import { StyleSheet, Theme, Constants, ReactNative as RN } from '@metro/common';
import { Icons } from '@api/assets';

const useStyles = StyleSheet.createStyles({
	recoveryContainer: {
		marginTop: 10
	},
	empty: {
		justifyContent: 'center',
		alignItems: 'center',
		marginVertical: 40
	},
	emptyImage: {
		marginBottom: 10
	},
	emptyMessage: {
		color: Theme.colors.TEXT_MUTED,
		fontFamily: Constants.Fonts.PRIMARY_SEMIBOLD,
		textAlign: 'center',
		paddingHorizontal: 25
	}
});

export const Empty = ({ children }) => {
	const styles = useStyles();

	return <RN.View style={styles.empty}>
		<RN.Image
			style={styles.emptyImage}
			source={Icons['img_connection_empty_dark']}
		/>
		<RN.Text style={styles.emptyMessage}>
			{children}
		</RN.Text>
	</RN.View>;
};

export default Empty;