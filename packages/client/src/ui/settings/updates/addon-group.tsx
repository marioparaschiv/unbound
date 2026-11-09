import type { InstalledEntry, PendingUpdate } from '~/updates/addon-updates';
import { messages, format } from '~/i18n/api';
import { Discord } from '~/metro/components';
import { icons } from '~/assets/api';

import CollapsibleGroup from './collapsible-group';
import UpdateRow from './update-row';

type AddonGroupProps = {
	addons: InstalledEntry[];
	updates: PendingUpdate[];
	/** Whether the last check finished, so an addon without an update is known to be current. */
	checked: boolean;
	/** The ids the Marketplace lists; `undefined` until a catalog is available. */
	listed: Set<string> | undefined;
};

/** @description The installed addons, collapsed unless an addon update is waiting. */
function AddonGroup({ addons, updates, checked, listed }: AddonGroupProps) {
	const count = format('UNBOUND_UPDATES_ADDONS_COUNT', { count: addons.length });
	const isListed = (entry: InstalledEntry) => !listed || listed.has(entry.id);
	// Stable sort keeps the name order within the listed and unlisted runs.
	const sorted = [...addons].sort((a, b) => Number(isListed(b)) - Number(isListed(a)));

	return (
		<CollapsibleGroup
			label={messages.UNBOUND_UPDATES_ADDONS}
			subLabel={
				updates.length
					? `${count} · ${format('UNBOUND_UPDATES_PENDING', { count: updates.length })}`
					: count
			}
			icon={<Discord.TableRowIcon source={icons.PuzzlePieceIcon} />}
			defaultExpanded={updates.length > 0}
		>
			{sorted.map((entry) => (
				<UpdateRow
					key={entry.id}
					entry={entry}
					update={updates.find((pending) => pending.id === entry.id)}
					checked={checked}
					listed={isListed(entry)}
				/>
			))}
		</CollapsibleGroup>
	);
}

export default AddonGroup;
