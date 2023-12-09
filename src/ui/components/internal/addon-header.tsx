import { ReactNative as RN, StyleSheet, Theme } from '@metro/common';
import Overflow from '@ui/components/overflow';
import { TabsUIState } from '@ui/components/form';
import getItems from '@ui/models/ordering';
import { getIDByName } from '@api/assets';
import { useSettingsStore } from '@api/storage';

type HeaderRightProps = {
	type: Arguments<typeof getItems>[0];
	settings: Arguments<typeof getItems>[1];
	onPress: Fn;
	margin?: boolean
};

const useStyles = StyleSheet.createStyles({
	icon: {
		tintColor: Theme.colors.INTERACTIVE_NORMAL
	}
});

export default function HeaderRight({ type, settings, onPress, margin = false }: HeaderRightProps) {
	const tabsEnabled = TabsUIState.useInMainTabsExperiment();
	const styles = useStyles();

	return <RN.View style={{ flexDirection: 'row', alignItems: 'center', marginRight: margin ? 12 : 0 }}>
		<Overflow
			items={getItems(type, settings)}
			iconSource={getIDByName('ArrowsUpDownIcon')}
			scale={0.85}
		/>
		<RN.TouchableOpacity
			style={{ ...(tabsEnabled ? {} : { marginRight: 16 }), marginLeft: 4 }}
			onPress={onPress}
		>
			<RN.Image
				source={getIDByName('PlusSmallIcon')}
				style={styles.icon}
			/>
		</RN.TouchableOpacity>
	</RN.View>;
}