import { TabsUIState } from '@ui/components/form';
import { getIDByName } from '@api/assets';
import { ReactNative as RN, Theme } from '@metro/common';
import { Theme as ThemeStore } from '@metro/stores';

import Overflow from '@ui/settings/components/overflow';
import getItems from '@ui/settings/models/ordering';

const { colors, meta: { resolveSemanticColor } } = Theme;

type HeaderRightProps = {
	type: Arguments<typeof getItems>[0];
	settings: Arguments<typeof getItems>[1];
	onPress: Fn;
}

export default function HeaderRight({ type, settings, onPress }: HeaderRightProps) {
	const tabsEnabled = TabsUIState.useInMainTabsExperiment();

	return <>
		<Overflow
			items={getItems(type, settings)}
			iconSource={getIDByName('ic_category_16px')}
		/>
		<RN.TouchableOpacity
			style={{ ...tabsEnabled ? {} : { marginRight: 16 }, marginLeft: 4 }}
			onPress={onPress}
		>
			<RN.Image
				source={getIDByName('ic_add_circle')}
				style={{ tintColor: resolveSemanticColor(ThemeStore.theme, colors.INTERACTIVE_NORMAL) } as any}
			/>
		</RN.TouchableOpacity>
	</>;
}