import { i18n, React, ReactNative as RN, Theme } from '@metro/common';
import { Addons, InstallModal } from '@ui/settings/components';
import { TabsUIState } from '@ui/components/form';
import { Theme as ThemeStore } from '@metro/stores';
import { Navigation } from '@metro/components';
import { getIDByName } from '@api/assets';
import Plugins from '@managers/plugins';
import { showInstallAlert } from '@ui/settings/components/install-modal';

const { colors, meta: { resolveSemanticColor } } = Theme;

export default () => {
	const navigation = Navigation.useNavigation();
	const addons = Plugins.useEntities();

	const unsubscribe = navigation.addListener('focus', () => {
		unsubscribe();

		navigation.setOptions({
			title: addons.length ? `${i18n.Messages.UNBOUND_PLUGINS} - ${addons.length}` : i18n.Messages.UNBOUND_PLUGINS,
			headerRight: HeaderRight
		});
	});

	return <RN.View style={{ flex: 1 }}>
		<Addons
			type='plugins'
			addons={addons}
		/>
	</RN.View>;
};

function HeaderRight() {
	const ref = React.useRef<InstanceType<typeof InstallModal.InstallInput>>();
	const tabsEnabled = TabsUIState.useInMainTabsExperiment();

	return <RN.TouchableOpacity
		style={tabsEnabled ? {} : { marginRight: 16 }}
		onPress={() => {
			showInstallAlert({ manager: Plugins, ref });
		}}
	>
		<RN.Image
			source={getIDByName('ic_add_circle')}
			style={{ tintColor: resolveSemanticColor(ThemeStore.theme, colors.INTERACTIVE_NORMAL) } as any}
		/>
	</RN.TouchableOpacity>;
}