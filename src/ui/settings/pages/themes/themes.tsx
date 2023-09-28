import { i18n, React, ReactNative as RN, Theme } from '@metro/common';
import { Theme as ThemeStore } from '@metro/stores';
import Themes from '@managers/themes';
import { Keys } from '@constants';
import { getIDByName } from '@api/assets';
import { Dialog } from '@metro/ui';

import { Addons, InstallModal } from '@ui/settings/components';
import Home from './editor/home';

import { TabsUIState } from '@ui/components/form';
import { useSettingsStore } from '@api/storage';
import { Navigation } from '@metro/components';
import { inputs } from './editor/create';

const { colors, meta: { resolveSemanticColor } } = Theme;

export default () => {
	const navigation = Navigation.useNavigation();
	const addons = Themes.useEntities();

	const unsubscribe = navigation.addListener('focus', () => {
		unsubscribe();
		navigation.setOptions({
			title: addons.length ? `${i18n.Messages.UNBOUND_THEMES} - ${addons.length}` : i18n.Messages.UNBOUND_THEMES,
			headerRight: HeaderRight
		});
	});

	return <RN.View style={{ flex: 1 }}>
		<Addons
			shouldRestart={true}
			type='themes'
			addons={addons}
		/>
	</RN.View>;
};

function HeaderRight() {
	const navigation = Navigation.useNavigation();
	const settings = useSettingsStore('create-theme');
	const ref = React.useRef<InstanceType<typeof InstallModal>>();
	const url = React.useCallback(() => ref.current?.getInput(), [ref.current]);
	const tabsEnabled = TabsUIState.useInMainTabsExperiment();

	return <RN.TouchableOpacity
		style={tabsEnabled ? {} : { marginRight: 16 }}
		onPress={() => {
			Dialog.confirm({
				title: i18n.Messages.UNBOUND_INSTALL_TITLE.format({ type: 'theme' }),
				confirmText: i18n.Messages.UNBOUND_THEME_GET_OPTION_CREATE,
				cancelText: i18n.Messages.UNBOUND_THEME_GET_OPTION_IMPORT,
				body: i18n.Messages.UNBOUND_THEME_GET_DESC,

				// On theme create
				onConfirm: () => {
					navigation.push(Keys.Custom, {
						title: i18n.Messages.UNBOUND_THEME_EDITOR,
						render: Home
					});

					inputs.forEach(({ key }) => settings.set(key, ''));
				},

				// On theme import
				onCancel: () => {
					Dialog.confirm({
						title: i18n.Messages.UNBOUND_INSTALL_TITLE.format({ type: 'theme' }),
						children: <InstallModal manager={Themes} ref={ref} />,
						confirmText: i18n.Messages.UNBOUND_INSTALL,
						onConfirm: () => url() && Themes.install(url())
					});
				}
			});
		}}
	>
		<RN.Image
			source={getIDByName('ic_add_circle')}
			style={{ tintColor: resolveSemanticColor(ThemeStore.theme, colors.INTERACTIVE_NORMAL) }}
		/>
	</RN.TouchableOpacity>;
}