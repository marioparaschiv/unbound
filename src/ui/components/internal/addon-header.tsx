import { ReactNative as RN, Theme } from '@metro/common';
import Overflow from '@ui/components/internal/overflow';
import { Theme as ThemeStore } from '@metro/stores';
import { TabsUIState } from '@ui/components/form';
import getItems from '@ui/models/ordering';
import { getIDByName } from '@api/assets';

const { colors, meta: { resolveSemanticColor } } = Theme;

type HeaderRightProps = {
	type: Arguments<typeof getItems>[0];
	settings: Arguments<typeof getItems>[1];
	onPress: Fn;
};

export default function HeaderRight({ type, settings, onPress }: HeaderRightProps) {
	const tabsEnabled = TabsUIState.useInMainTabsExperiment();

	return <RN.View style={{ flexDirection: 'row', alignItems: 'center' }}>
		<Overflow
			items={getItems(type, settings)}
			iconSource={getIDByName('ic_sort')}
		/>
		<RN.TouchableOpacity
			style={{ ...(tabsEnabled ? {} : { marginRight: 16 }), marginLeft: 4 }}
			onPress={onPress}
		>
			<RN.Image
				source={getIDByName('PlusSmallIcon')}
				style={{ tintColor: resolveSemanticColor(ThemeStore.theme, colors.INTERACTIVE_NORMAL) } as any}
			/>
		</RN.TouchableOpacity>
	</RN.View>;
}