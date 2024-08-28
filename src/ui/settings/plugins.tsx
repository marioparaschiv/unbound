import { showInstallAlert } from '@ui/addons/install-modal';
import { Design } from '@api/metro/components';
import PluginManager from '@managers/plugins';
import { AddonList } from '@ui/addons';
import { Strings } from '@api/i18n';
import { View } from 'react-native';

export default function Plugins({ headerRightMargin = false }: { headerRightMargin: boolean; }) {
	const navigation = Design.useNavigation();
	const addons = PluginManager.useEntities();

	const unsubscribe = navigation.addListener('focus', () => {
		unsubscribe();

		navigation.setOptions({
			title: addons.length ? `${Strings.UNBOUND_PLUGINS} - ${addons.length}` : Strings.UNBOUND_PLUGINS,
		});
	});

	return <View>
		<AddonList
			type='Plugins'
			addons={addons}
			onPressInstall={({ type, ref }) => showInstallAlert({ type, ref })}
			headerRightMargin={headerRightMargin}
		/>
	</View>;
};

