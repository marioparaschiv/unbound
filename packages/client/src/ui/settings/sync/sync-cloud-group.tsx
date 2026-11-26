import type { SyncKind } from '@unbound-app/contracts/sync';

import { SYNC_KIND_ROWS } from '~/ui/settings/sync/sync-options';
import { describeKind } from '~/ui/settings/sync/describe-sync';
import type { SyncKindSummary } from '~/sync/device';
import { Discord } from '~/metro/components';
import { Moment } from '~/metro/common';
import { messages } from '~/i18n/api';
import { icons } from '~/assets/api';

type SyncCloudGroupProps = {
	summary: Record<SyncKind, SyncKindSummary>;
	/** When the cloud's copy was last saved, as an ISO date. */
	updatedAt: string | null;
};

/**
 * @description What the cloud held after the last sync: each kind's count, and what differs from this device.
 * Plugins always show; another kind only once either side has one.
 */
function SyncCloudGroup({ summary, updatedAt }: SyncCloudGroupProps) {
	const rows = SYNC_KIND_ROWS.filter(
		({ kind }) => kind === 'plugins' || summary[kind].cloud || summary[kind].unsynced.length,
	);

	return (
		<Discord.TableRowGroup title={messages.UNBOUND_CLOUD_SYNC_IN_CLOUD}>
			{rows.map((row) => (
				<Discord.TableRow
					key={row.kind}
					label={messages[row.label]}
					subLabel={describeKind(summary[row.kind])}
					icon={<Discord.TableRowIcon source={icons[row.icon] ?? icons.CloudIcon} />}
					trailing={
						<Discord.TableRow.TrailingText text={String(summary[row.kind].cloud)} />
					}
				/>
			))}
			{updatedAt ? (
				<Discord.TableRow
					label={messages.UNBOUND_CLOUD_SYNC_CLOUD_SAVED}
					icon={<Discord.TableRowIcon source={icons.ClockIcon} />}
					trailing={
						<Discord.TableRow.TrailingText text={Moment.utc(updatedAt).fromNow()} />
					}
				/>
			) : null}
		</Discord.TableRowGroup>
	);
}

export default SyncCloudGroup;
