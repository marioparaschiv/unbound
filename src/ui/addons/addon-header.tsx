import { TouchableOpacity, View } from 'react-native';
import getItems from '@ui/addons/addon-ordering';
import { TintedIcon } from '@ui/misc/forms';
import { getIDByName } from '@api/assets';
import Overflow from '@ui/misc/overflow';
import { capitalize } from '@utilities';
import { Strings } from '@api/i18n';

type HeaderRightProps = {
	type: Parameters<typeof getItems>[0];
	settings: Parameters<typeof getItems>[1];
	onPress: Fn;
	margin?: boolean;
};

export default function HeaderRight({ type, settings, onPress, margin = false }: HeaderRightProps) {
	return <View style={{ flexDirection: 'row', alignItems: 'center', marginRight: margin ? 12 : 0 }}>
		<Overflow
			title={Strings['UNBOUND_ORDER_ADDONS'].format({ type: capitalize(typeof type === 'function' ? type() : type) })}
			items={getItems(type, settings)}
			iconSource={getIDByName('ArrowsUpDownIcon')}
			scale={0.85}
		/>
		<TouchableOpacity
			style={{ marginLeft: 4 }}
			onPress={onPress}
		>
			<TintedIcon source={getIDByName('PlusSmallIcon')} />
		</TouchableOpacity>
	</View>;
}