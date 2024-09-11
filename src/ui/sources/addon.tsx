import { TintedIcon, TrailingText } from '@ui/misc/forms';
import { useIcon, type Bundle } from '@managers/sources';
import { AddonPage } from '@ui/sources/addon-page';
import { Design } from '@api/metro/components';
import { SETTINGS_KEYS } from '@constants';
import * as Managers from '@managers';
import { Icons } from '@api/assets';
import { View } from 'react-native';

export function Addon({ addon, navigation }: { addon: Bundle[number], navigation: any; }) {
	const { manifest: { id, icon: _icon, name, description, version }, type } = addon;
	const icon = useIcon(_icon);
	const manager = Managers[type];
	const installed = manager.entities.has(id);

	return <Design.TableRow
		icon={<Design.TableRowIcon source={icon} />}
		label={name}
		subLabel={description}
		trailing={<View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
			<TrailingText>{version}</TrailingText>
			<TintedIcon
				source={Icons[installed ? 'CheckmarkLargeIcon' : 'CloseLargeIcon']}
				size={14}
			/>
			<TintedIcon
				source={Icons[manager.icon]}
				size={14}
			/>
		</View>}
		arrow
		onPress={() => navigation.push(SETTINGS_KEYS.Custom, {
			title: name,
			render: () => <AddonPage
				addon={addon}
				navigation={navigation}
			/>
		})}
	/>;
}