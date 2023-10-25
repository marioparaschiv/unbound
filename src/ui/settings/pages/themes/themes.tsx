import { i18n, React, ReactNative as RN, Theme } from '@metro/common';
import { Theme as ThemeStore } from '@metro/stores';
import Themes from '@managers/themes';
import { Keys } from '@constants';
import { getIDByName } from '@api/assets';

import { Addons, InstallModal } from '@ui/settings/components';
import Home from './editor/home';

import { TabsUIState } from '@ui/components/form';
import { useSettingsStore } from '@api/storage';
import { Navigation } from '@metro/components';
import { inputs } from './editor/create';
import { showAlert } from '@api/dialogs';
import { showInstallAlert } from '@ui/settings/components/install-modal';

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
	</RN.View>
};

function HeaderRight() {
	const navigation = Navigation.useNavigation();
	const settings = useSettingsStore('create-theme');
	const ref = React.useRef<InstanceType<typeof InstallModal.InstallInput>>();
	const tabsEnabled = TabsUIState.useInMainTabsExperiment();

	return <RN.TouchableOpacity
		style={tabsEnabled ? {} : { marginRight: 16 }}
		onPress={() => {
			showAlert({
				title: i18n.Messages.UNBOUND_INSTALL_TITLE.format({ type: 'theme' }),
				content: i18n.Messages.UNBOUND_THEME_GET_DESC,
				buttons: [
					{
						text: i18n.Messages.UNBOUND_THEME_GET_OPTION_IMPORT,
						onPress: () => showInstallAlert({ type: 'themes', ref })
					},
					{
						text: i18n.Messages.UNBOUND_THEME_GET_OPTION_CREATE,
						variant: 'primary-alt',
						onPress: () => {
							navigation.push(Keys.Custom, {
								title: i18n.Messages.UNBOUND_THEME_EDITOR,
								render: Home
							});

							inputs.forEach(({ key }) => settings.set(key, ''));
						}
					},
				]
			})
		}}
	>
		<RN.Image
			source={getIDByName('ic_add_circle')}
			style={{ tintColor: resolveSemanticColor(ThemeStore.theme, colors.INTERACTIVE_NORMAL) }}
		/>
	</RN.TouchableOpacity>;
}