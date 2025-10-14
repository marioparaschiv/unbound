import { ManagerNames, type ManagerKind } from '~/lib/constants';
import type { Addon } from '@unbound-app/types/managers';
import type { Values } from '@unbound-app/types/utils';
import { useSettingsStore } from '~/api/storage';
import { Discord } from '~/api/metro/components';
import { Switch } from '~/ui/misc/forms';
import * as Managers from '~/managers';
import { View } from 'react-native';
import { useMemo } from 'react';

import useStyles from './addon-card.style';


export interface AddonCardProps {
	addon: Addon;
	kind: ManagerKind;
}

function AddonCard(props: AddonCardProps) {
	const { addon, kind } = props;

	const manager = useMemo<Values<typeof Managers>>(() => Managers[ManagerNames[kind]], [kind]);
	const settings = useSettingsStore('unbound', ({ key }) => key === 'recovery');
	const styles = useStyles();

	if (!manager) return null;

	return <View style={styles.container}>
		<Discord.Card style={styles.card}>
			<View style={styles.header}>
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