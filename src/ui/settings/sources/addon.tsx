import { TintedIcon, TrailingText } from '@ui/components/misc';
import { AddonPage } from '@ui/settings/sources/addon-page';
import { useIcon, type Bundle } from '@managers/sources';
import { ReactNative as RN } from '@metro/common';
import { Redesign } from '@metro/components';
import * as Managers from '@managers';
import { Icons } from '@api/assets';
import { Keys } from '@constants';

export function Addon({ addon, navigation }: { addon: Bundle[number], navigation: any }) {
	const { manifest: { id, icon: _icon, name, description, version }, type } = addon;
	const icon = useIcon(_icon);
	const manager = Managers[type];
	const installed = manager.entities.has(id);

	return <Redesign.TableRow
		icon={<Redesign.TableRowIcon source={icon} />}
		label={name}
		subLabel={description}
		trailing={<RN.View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
			<TrailingText>{version}</TrailingText>
			<TintedIcon
				source={Icons[installed ? 'CheckmarkLargeIcon' : 'CloseLargeIcon']}
				size={14}
			/>
			<TintedIcon
				source={Icons[manager.icon]}
				size={14}
			/>
		</RN.View>}
		arrow
		onPress={() => navigation.push(Keys.Custom, {
			title: name,
			render: () => <AddonPage
				addon={addon}
				navigation={navigation}
			/>
		})}
	/>;
}