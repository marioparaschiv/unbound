import type { CrashOrigin } from '@unbound-app/contracts/crash-reports';

import type { CrashRecord } from '~/diagnostics/crash-history';
import { Discord } from '~/metro/components';
import { Manager } from '~/addons/manager';
import { messages } from '~/i18n/api';
import { icons } from '~/assets/api';

const ORIGIN_LABELS: Record<CrashOrigin, () => string> = {
	unbound: () => messages.UNBOUND_CRASH_ORIGIN_UNBOUND,
	addon: () => messages.UNBOUND_CRASH_ORIGIN_ADDON,
	discord: () => messages.UNBOUND_CRASH_ORIGIN_DISCORD,
	system: () => messages.UNBOUND_CRASH_ORIGIN_SYSTEM,
};

function crashDetails(record: CrashRecord, pluginName: string | undefined): string {
	return [
		new Date(record.at).toLocaleString(),
		pluginName,
		record.origin && ORIGIN_LABELS[record.origin](),
		record.reportId && `#${record.reportId.slice(0, 8)}`,
	]
		.filter(Boolean)
		.join(' · ');
}

type CrashRowProps = { record: CrashRecord; onDisable: (id: string) => void };

/**
 * @description One recorded crash: its message, when it happened, the plugin it blamed and where it came from, with a
 * button to disable that plugin while it is on.
 */
function CrashRow({ record, onDisable }: CrashRowProps) {
	const plugins = Manager.for('plugin');
	const plugin = record.addon ? plugins.getAddon(record.addon) : undefined;
	const enabled = plugin ? plugins.isEnabled(plugin.id) : false;

	return (
		<Discord.TableRow
			label={record.message}
			subLabel={crashDetails(record, plugin?.name)}
			icon={<Discord.TableRowIcon source={icons.BugIcon ?? icons.WarningIcon} />}
			trailing={
				plugin && enabled ? (
					<Discord.Button
						size='sm'
						variant='destructive'
						text={messages.UNBOUND_CRASH_DISABLE_PLUGIN}
						onPress={() => onDisable(plugin.id)}
					/>
				) : null
			}
		/>
	);
}

export default CrashRow;
