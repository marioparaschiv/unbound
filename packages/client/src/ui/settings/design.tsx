import { Discord } from '~/api/metro/components';
import AddonList from '~/ui/addons/addon-list';
import { ManagerKind } from '~/lib/constants';
import { useAddons } from '~/ui/hooks';
import { Strings } from '~/api/i18n';
import { View } from 'react-native';


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
