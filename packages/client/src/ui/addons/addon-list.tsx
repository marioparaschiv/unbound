import type { Addon } from '@unbound-app/types';
import { useMemo } from 'react';

import { ManagerKind, ManagerNames } from '~/lib/constants';
import { Discord } from '~/api/metro/components';
import { useSettingsStore } from '~/api/storage';
import { getManager } from '~/managers/utils';

type AddonListProps = {
	addons: Addon[];
	kind: ManagerKind;
};

/**
 * @description Renders a group of addons as switch rows, each toggling its addon through the manager.
 */
function AddonList({ addons, kind }: AddonListProps) {
	const manager = getManager(kind);
	const storeName = ManagerNames[kind].toLowerCase();

	const settings = useSettingsStore(storeName, ({ key }) => key === 'states');
	const recovery = useSettingsStore('unbound', ({ key }) => key === 'recovery').get(
		'recovery',
		false,
	);

	const states = settings.get<Record<string, boolean>>('states', {});

	const rows = useMemo(
		() =>
			addons.map((addon) => (
				<Discord.TableSwitchRow
					key={addon.id}
					label={addon.data.name}
					subLabel={addon.data.description}
					value={Boolean(states[addon.id])}
					disabled={addon.failed || recovery}
					onValueChange={() => manager.toggle(addon.id)}
				/>
			)),
		[addons, states, recovery, manager],
	);

	return <Discord.TableRowGroup>{rows}</Discord.TableRowGroup>;
}

export default AddonList;
