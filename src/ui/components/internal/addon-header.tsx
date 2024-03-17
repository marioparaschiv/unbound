import { ReactNative as RN } from '@metro/common';
import { TintedIcon } from '@ui/components/misc';
import Overflow from '@ui/components/overflow';
import getItems from '@ui/models/ordering';
import { getIDByName } from '@api/assets';
import { Strings } from '@api/i18n';
import { capitalize } from '@utilities';

type HeaderRightProps = {
	type: Parameters<typeof getItems>[0];
	settings: Parameters<typeof getItems>[1];
	onPress: Fn;
	margin?: boolean
};

export default function HeaderRight({ type, settings, onPress, margin = false }: HeaderRightProps) {
	return <RN.View style={{ flexDirection: 'row', alignItems: 'center', marginRight: margin ? 12 : 0 }}>
		<Overflow
			title={Strings['UNBOUND_ORDER_ADDONS'].format({ type: capitalize(typeof type === 'function' ? type() : type) })}
			items={getItems(type, settings)}
			iconSource={getIDByName('ArrowsUpDownIcon')}
			scale={0.85}
		/>
		<RN.TouchableOpacity
			style={{ marginLeft: 4 }}
			onPress={onPress}
		>
			<TintedIcon source={getIDByName('PlusSmallIcon')} />
		</RN.TouchableOpacity>
	</RN.View>;
}