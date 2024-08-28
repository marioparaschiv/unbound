import { showInstallAlert } from '@ui/addons/install-modal';
import { Icons as IconProxy } from '@api/assets';
import { TintedIcon } from '@ui/misc/forms';
import { AddonList } from '@ui/addons';
import Icons from '@managers/icons';
import { View } from 'react-native';

function IconsPage() {
	const addons = Icons.useEntities();

	return <View style={{ flex: 1 }}>
		<AddonList
			showHeaderRight={false}
			showManagerIcon={(addon) => addon.data.id !== 'default'}
			type='Icons'
			addons={addons}
		/>
	</View>;
}

export const callback = ({ type, ref }) => showInstallAlert({ type, ref });
export default {
	page: <IconsPage />,
	callback,
	icon: <TintedIcon source={IconProxy[Icons.icon]} />
};