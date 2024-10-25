import { TintedIcon } from '@ui/misc/forms';
import { View } from 'react-native';
import { Icons } from '@api/assets';
import { noop } from '@utilities';


function FontsPage() {
	const fonts = window.UNBOUND_FONTS ?? [];

	return <View style={{ flex: 1 }}>
		{fonts.map((font) => <View key={font.name}>
			{font.name}
		</View>)}
	</View>;
}

export const callback = noop;
export default {
	page: <FontsPage />,
	callback,
	icon: <TintedIcon source={Icons['ic_add_text']} />
};