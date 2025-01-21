import { showInstallAlert } from '@ui/addons/install-modal';
import { TintedIcon } from '@ui/misc/forms';
import { AddonList } from '@ui/new-addons';
import { showDialog } from '@api/dialogs';
import { ManagerKind } from '@constants';
import { useAddons } from '@ui/hooks';
import { View } from 'react-native';
import { Strings } from '@api/i18n';
import { Icons } from '@api/assets';
import { noop } from '@utilities';


function ThemesPage() {
	const addons = useAddons('Themes');

	console.log(addons);

	return <View style={{ flex: 1 }}>
		<AddonList
			kind={ManagerKind.THEMES}
			addons={addons}
		/>
	</View>;
};

export const callback = ({ type, ref }) => {
	showDialog({
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
				onPress: noop
			},
		]
	});
};

export default {
	page: <ThemesPage />,
	callback,
	icon: <TintedIcon source={Icons['PaintPaletteIcon']} />
};