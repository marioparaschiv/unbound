import { ReactNative as RN, StyleSheet, Theme } from '@metro/common';
import Overflow from '@ui/components/overflow';
import getItems from '@ui/models/ordering';
import { getIDByName } from '@api/assets';

type HeaderRightProps = {
	type: Parameters<typeof getItems>[0];
	settings: Parameters<typeof getItems>[1];
	onPress: Fn;
	margin?: boolean
};

const useStyles = StyleSheet.createStyles({
	icon: {
		tintColor: Theme.colors.INTERACTIVE_NORMAL
	}
});

export default function HeaderRight({ type, settings, onPress, margin = false }: HeaderRightProps) {
	const styles = useStyles();

	return <RN.View style={{ flexDirection: 'row', alignItems: 'center', marginRight: margin ? 12 : 0 }}>
		<Overflow
			items={getItems(type, settings)}
			iconSource={getIDByName('ArrowsUpDownIcon')}
			scale={0.85}
		/>
		<RN.TouchableOpacity
			style={{ marginLeft: 4 }}
			onPress={onPress}
		>
			<RN.Image
				source={getIDByName('PlusSmallIcon')}
				style={styles.icon}
			/>
		</RN.TouchableOpacity>
	</RN.View>;
}