import { i18n, React, ReactNative as RN } from '@metro/common';
import Themes from '@managers/themes';

import { Addons } from '@ui/settings/components';

import { showAlert } from '@api/dialogs';
import { showInstallAlert } from '@ui/settings/components/install-modal';
import { noop } from '@utilities';

function ThemesPage() {
	const addons = Themes.useEntities();

	return <RN.View style={{ flex: 1 }}>
		<Addons
			shouldRestart={true}
			type='themes'
			addons={addons}
		/>
	</RN.View>
};

export const callback = ({ ref }) => {
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
				onPress: noop
			},
		]
	})
}

export default { page: <ThemesPage />, callback }