import { Discord } from '@api/metro/components';
import { AddonList } from '@ui/new-addons';
import { ManagerKind } from '@constants';
import { View } from 'react-native';
import { Strings } from '@api/i18n';


function SourcesPage() {
	const navigation = Discord.useNavigation();
	const addons = /* useAddons('Plugins') */[];

	const unsubscribe = navigation.addListener('focus', () => {
		unsubscribe();

		navigation.setOptions({
			title: addons.length ? `${Strings.UNBOUND_SOURCES} - ${addons.length}` : Strings.UNBOUND_SOURCES,
		});
	});

	return <View>
		<AddonList
			kind={ManagerKind.SOURCES}
			addons={addons}
		// onPressInstall={({ type, ref }) => showInstallAlert({ type, ref })}
		/>
	</View>;
};

export default SourcesPage;