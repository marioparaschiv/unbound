import { TintedIcon, TrailingText } from '@ui/misc/forms';
import { useIcon, type Bundle } from '@managers/sources';
import { AddonPage } from '@ui/sources/addon-page';
import { Discord } from '@api/metro/components';
import { SettingsKeys } from '@constants';
import * as Managers from '@managers';
import { View } from 'react-native';
import { Icons } from '@api/assets';


export function Addon({ addon, navigation }: { addon: Bundle[number], navigation: any; }) {
	const { manifest: { id, icon: _icon, name, description, version }, type } = addon;
	const icon = useIcon(_icon);
	const manager = Managers[type];
	const installed = manager.entities.has(id);

	return <Discord.TableRow
		icon={<Discord.TableRowIcon source={icon} />}
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
		onPress={() => navigation.push(SettingsKeys.Custom, {
			title: name,
			render: () => <AddonPage
				addon={addon}
				navigation={navigation}
			/>
		})}
	/>;
}