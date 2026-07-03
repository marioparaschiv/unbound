import { memo } from 'react';

import { ManagerKind, ManagerNames } from '~/lib/constants';
import { Empty } from '~/ui/components';
import { useAddons } from '~/ui/hooks';
import { format } from '~/api/i18n';

import AddonCard from './addon-card';

type AddonListProps = {
	kind: ManagerKind.Plugins | ManagerKind.Themes | ManagerKind.Icons;
};

/**
 * @description Renders a manager's addons as cards, or an empty state when there are none. Subscribes
 * to the manager through {@link useAddons}, so installs, deletes, and toggles reflect automatically.
 */
function AddonList({ kind }: AddonListProps) {
	const addons = useAddons(kind);

	if (!addons.length) {
		const type = ManagerNames[kind].toLowerCase();
		return <Empty>{format('UNBOUND_NO_ADDONS', { type })}</Empty>;
	}

	return (
		<>
			{addons.map((addon) => (
				<AddonCard key={addon.id} addon={addon} kind={kind} />
			))}
		</>
	);
}

export default memo(AddonList);
