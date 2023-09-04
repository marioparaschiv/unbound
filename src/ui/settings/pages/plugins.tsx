import { i18n, React, ReactNative as RN, Theme } from '@metro/common';
import { Theme as ThemeStore } from '@metro/stores';
import Plugins from '@managers/plugins';
import { getIDByName } from '@api/assets';
import { Dialog } from '@metro/ui';

import { Addons, InstallModal } from '../components';
import { Navigation } from '@metro/components';
import { TabsUIState } from '@ui/components/form-handler';

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
	const ref = React.useRef<InstanceType<typeof InstallModal>>();
	const url = React.useCallback(() => ref.current?.getInput(), [ref.current]);
	const tabsEnabled = TabsUIState.useInMainTabsExperiment();

	return <RN.TouchableOpacity
		style={tabsEnabled ? {} : { marginRight: 16 }}
		onPress={() => {
			Dialog.confirm({
				title: i18n.Messages.UNBOUND_INSTALL_TITLE.format({ type: 'plugin' }),
				children: <InstallModal manager={Plugins} ref={ref} />,
				confirmText: i18n.Messages.UNBOUND_INSTALL,
				onConfirm: () => url() && Plugins.install(url())
			});
		}}
	>
		<RN.Image
			source={getIDByName('ic_add_circle')}
			style={{ tintColor: resolveSemanticColor(ThemeStore.theme, colors.INTERACTIVE_NORMAL) } as any}
		/>
	</RN.TouchableOpacity>;
}