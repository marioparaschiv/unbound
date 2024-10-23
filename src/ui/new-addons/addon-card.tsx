import type { AddonCardProps } from '@typings/ui/addons/addon-card';
import { useSettingsStore } from '@api/storage';
import { Discord } from '@api/metro/components';
import { ManagerNames } from '@constants';
import { Switch } from '@ui/misc/forms';
import * as Managers from '@managers';
import { View } from 'react-native';
import { useMemo } from 'react';


function AddonCard(props: AddonCardProps) {
	const { addon, kind } = props;

	const settings = useSettingsStore('unbound', ({ key }) => key === 'recovery');
	const manager = useMemo<Values<typeof Managers>>(() => Managers[ManagerNames[kind]], [kind]);

	if (!manager) return null;

	return <View style={{ margin: 20 }}>
		<Discord.Card style={{ flexDirection: 'column' }}>
			<View>
				<Discord.Text color='text-normal' variant='text-lg/bold'>
					{addon.data.name}
				</Discord.Text>
				<Switch.FormSwitch
					disabled={addon.failed || settings.get('recovery', false)}
					value={manager.isEnabled(addon.id)}
					onValueChange={() => manager.toggle(addon.id)}
				/>
			</View>
			<Discord.Text color='text-muted' variant='text-md/normal'>
				{addon.data.description}
			</Discord.Text>
		</Discord.Card>
	</View>;
}

export default AddonCard;