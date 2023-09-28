import { i18n, React, ReactNative as RN, Theme } from '@metro/common';
import { Addons, InstallModal } from '@ui/settings/components';
import { Form, TabsUIState } from '@ui/components/form';
import { showConfirmationAlert } from '@api/dialogs';
import { Theme as ThemeStore } from '@metro/stores';
import { Navigation } from '@metro/components';
import { getIDByName } from '@api/assets';
import Plugins from '@managers/plugins';

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

	return <Form style={{ flex: 1 }}>
		<Addons
			type='plugins'
			addons={addons}
		/>
	</Form>;
};

function HeaderRight() {
	const ref = React.useRef<InstanceType<typeof InstallModal>>();
	const url = React.useCallback(() => ref.current?.getInput(), [ref.current]);
	const tabsEnabled = TabsUIState.useInMainTabsExperiment();

	return <RN.TouchableOpacity
		style={tabsEnabled ? {} : { marginRight: 16 }}
		onPress={() => {
			showConfirmationAlert({
				title: i18n.Messages.UNBOUND_INSTALL_TITLE.format({ type: 'plugin' }),
				content: <InstallModal manager={Plugins} ref={ref} />,
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