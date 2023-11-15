import { StyleSheet, Theme, ReactNative as RN, React } from '@metro/common';
import { managers } from '@api';
import { Manager } from '@typings/managers';
import { getIDByName } from '@api/assets';

export const resolveType = (entity: Manager | Fn<Manager>) => {
	const resolved = typeof entity === 'function' ? entity() : entity;
	return managers[resolved].type;
}

const useStyles = StyleSheet.createStyles({
	trailing: {
		flex: 1,
		flexDirection: 'row',
		alignItems: 'center'
	},

	icon: {
		tintColor: Theme.colors.INTERACTIVE_NORMAL,
		width: undefined,
		aspectRatio: 1
	}
});

export const TrailingIcon = ({ selected, source }) => {
	const styles = useStyles();

	return <RN.View style={styles.trailing}>
		{selected && <RN.Image
			source={getIDByName('CheckmarkLargeIcon')}
			style={[styles.icon, { height: 14 }]}
		/>}
		<RN.Image
			source={getIDByName(source)}
			style={[styles.icon, { height: 20, marginLeft: 6 }]}
		/>
	</RN.View>
}