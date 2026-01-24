import { Discord } from '~/api/metro/components';
import AddonList from '~/ui/addons/addon-list';
import { ManagerKind } from '~/lib/constants';
import { useAddons } from '~/ui/hooks';
import { Strings } from '~/api/i18n';
import { View } from 'react-native';


export default function Plugins() {
	const navigation = Discord.useNavigation();
	const addons = useAddons('Plugins');

	const unsubscribe = navigation.addListener('focus', () => {
		unsubscribe();

		navigation.setOptions({
			title: addons.length ? `${Strings.UNBOUND_PLUGINS} - ${addons.length}` : Strings.UNBOUND_PLUGINS,
		});
	});

	return <View style={{ flex: 1 }}>
		<AddonList
			kind={ManagerKind.PLUGINS}
			addons={addons}
		/>
	</View>;
};

