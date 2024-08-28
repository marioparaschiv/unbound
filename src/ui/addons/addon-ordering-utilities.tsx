import type { Manager } from '@typings/managers';
import { TintedIcon } from '@ui/misc/forms';
import { StyleSheet } from '@metro/common';
import { getIDByName } from '@api/assets';
import * as managers from '@managers';
import { View } from 'react-native';

export const resolveType = (entity: Manager | Fn<Manager>) => {
	const resolved = typeof entity === 'function' ? entity() : entity;
	return managers[resolved].type;
};

const useStyles = StyleSheet.createStyles({
	trailing: {
		flex: 1,
		flexDirection: 'row',
		alignItems: 'center'
	}
});

export const TrailingIcon = ({ selected, source }: { selected: boolean; source: string; }) => {
	const styles = useStyles();

	return <View style={styles.trailing}>
		{selected && <TintedIcon
			source={getIDByName('CheckmarkLargeIcon')}
			size={14}
			style={{ height: 14 }}
		/>}
		<TintedIcon
			source={getIDByName(source)}
			size={20}
			style={{ height: 20, marginLeft: 6 }}
		/>
	</View>;
};