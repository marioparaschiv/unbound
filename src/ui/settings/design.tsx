import { Discord } from '@api/metro/components';
import AddonList from '@ui/addons/addon-list';
import { ManagerKind } from '@constants';
import { useAddons } from '@ui/hooks';
import { View } from 'react-native';
import { Strings } from '@api/i18n';


export default function Design() {
	const navigation = Discord.useNavigation();
	const addons = useAddons('Themes');

	const unsubscribe = navigation.addListener('focus', () => {
		unsubscribe();

		navigation.setOptions({
			title: addons.length ? `${Strings.UNBOUND_THEMES} - ${addons.length}` : Strings.UNBOUND_THEMES,
		});
	});

	return <View style={{ flex: 1 }}>
		<AddonList
			kind={ManagerKind.THEMES}
			addons={addons}
		/>
	</View>;
};
