import { React, ReactNative as RN, Theme } from '@metro/common';
import { Forms, Navigation } from '@metro/components';
import { capitalize } from '@utilities';
import { Icons } from '@api/assets';

export default ({ initial }) => {
	const navigation = Navigation.useNavigation();

	const keys = Object.keys(Theme.colors);

	React.useEffect(() => {
		navigation.setOptions({ headerRight: () => <Add /> });
	}, []);

	return <RN.ScrollView>
		<Forms.FormSection style={{ flex: 1 }}>
			{keys.map(k => <Forms.FormRow
				key={k}
				label={k.split('_').map(k => capitalize(k.toLowerCase()))}
			/>)}
		</Forms.FormSection>
	</RN.ScrollView >;
};

function Add() {
	const navigation = Navigation.useNavigation();

	return <RN.Pressable
		hitSlop={25}
		style={({ pressed }) => ({ opacity: pressed ? 0.5 : 1.0, marginRight: 20 })}
		onPress={() => {

		}}>
		<RN.Image source={Icons['ic_add_circle']} />
	</RN.Pressable>;
}