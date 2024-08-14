import { showInstallAlert } from '@ui/components/internal/install-modal';
import { React, ReactNative as RN } from '@metro/common';
import { Addons } from '@ui/components/internal';
import { TintedIcon } from '@ui/components/misc';
import { showAlert } from '@api/dialogs';
import Themes from '@managers/themes';
import { Strings } from '@api/i18n';
import { Icons } from '@api/assets';
import { noop } from '@utilities';
import { Keys } from '@constants';

function ThemesPage() {
	const addons = Themes.useEntities();

	return <RN.View style={{ flex: 1 }}>
		<Addons
			showHeaderRight={false}
			showToggles={false}
			type='Themes'
			addons={addons}
		/>
	</RN.View>;
};

export const callback = ({ type, ref, navigation }) => {
	showAlert({
		title: Strings.UNBOUND_INSTALL_TITLE.format({ type: 'theme' }),
		content: Strings.UNBOUND_THEME_GET_DESC,
		buttons: [
			{
				text: Strings.UNBOUND_THEME_GET_OPTION_IMPORT,
				onPress: () => showInstallAlert({ type, ref })
			},
			{
				text: Strings.UNBOUND_THEME_GET_OPTION_CREATE,
				variant: 'tertiary',
				// Should push editor/index.tsx
        onPress: () => navigation.push(Keys.Custom, {
          title: Strings.UNBOUND_THEME_EDITOR,
          render: () => {
            const SelectPage = React.lazy(() => import('@ui/settings/design/editor/select')
								.then(({ SelectPage }) => ({ default: SelectPage })));

							return <SelectPage />;
          }
        })
			},
		]
	});
};

export default {
	page: <ThemesPage />,
	callback,
	icon: <TintedIcon source={Icons[Themes.icon]} />
};
