import type { CrashOrigin } from '@unbound-app/contracts/crash-reports';

import type { CrashIssueLink, CrashRecord } from '~/diagnostics/crash-history';
import { freezeCause, hangDuration } from '~/diagnostics/crash-title';
import { crashReportAddon } from '~/diagnostics/crash-report';
import reportCrashOnGitHub from '~/ui/settings/report-crash';
import { format, messages } from '~/i18n/api';
import { Discord } from '~/metro/components';
import { Manager } from '~/addons/manager';
import { API_URL } from '~/core/constants';
import { Clipboard } from '~/metro/common';
import { icons } from '~/assets/api';
import { info } from '~/toasts/api';

const ORIGIN_LABELS: Record<CrashOrigin, () => string> = {
	unbound: () => messages.UNBOUND_CRASH_ORIGIN_UNBOUND,
	addon: () => messages.UNBOUND_CRASH_ORIGIN_ADDON,
	discord: () => messages.UNBOUND_CRASH_ORIGIN_DISCORD,
	system: () => messages.UNBOUND_CRASH_ORIGIN_SYSTEM,
};

const ISSUE_LABELS = {
	open: 'UNBOUND_CRASH_KNOWN_ISSUE',
	fixed: 'UNBOUND_CRASH_ISSUE_FIXED',
	closed: 'UNBOUND_CRASH_ISSUE_CLOSED',
} as const;

function crashDetails(record: CrashRecord, pluginName: string | undefined): string {
	return [
		new Date(record.at).toLocaleString(),
		pluginName,
		record.origin && ORIGIN_LABELS[record.origin](),
		record.issue
			? format(ISSUE_LABELS[record.issueState ?? 'open'], { number: record.issue.number })
			: record.reportId && `#${record.reportId.slice(0, 8)}`,
	]
		.filter(Boolean)
		.join(' · ');
}

function crashTitle(record: CrashRecord): string {
	const cause = record.kind === 'freeze' ? freezeCause(record.message) : undefined;

	if (cause) {
		return format('UNBOUND_CRASH_TITLE_FROZE', cause);
	}

	const hang = record.kind === 'freeze' ? hangDuration(record.message) : undefined;

	if (hang && record.where) {
		return format('UNBOUND_CRASH_TITLE_HANG_IN', { duration: hang, place: record.where });
	}

	if (hang) {
		return format('UNBOUND_CRASH_TITLE_HANG', { duration: hang });
	}

	if (record.kind === 'native-crash' && record.where && !record.message.includes(' in ')) {
		return format('UNBOUND_CRASH_TITLE_NATIVE', {
			signal: record.message,
			place: record.where,
		});
	}

	return record.message;
}

function copyIssueLink(issue: CrashIssueLink) {
	Clipboard.setString(`${API_URL}/c/${issue.number}`);
	info('UNBOUND_CRASH_LINK_COPIED', { number: issue.number });
}

type CrashRowProps = {
	record: CrashRecord;
	onDisable: (id: string) => void;
	onLinked: (at: number, issue: CrashIssueLink) => void;
};

/**
 * @description One recorded crash: its message, when it happened, the plugin it blamed and where it came from, with a
 * button to disable that plugin while it is on. Tapping it opens its GitHub issue, or offers to have Unbound file one; holding it copies a short link to the issue.
 */
function CrashRow({ record, onDisable, onLinked }: CrashRowProps) {
	const plugins = Manager.for('plugin');
	const plugin = record.addon ? plugins.getAddon(record.addon) : undefined;
	const enabled = plugin ? plugins.isEnabled(plugin.id) : false;

	return (
		<Discord.TableRow
			label={crashTitle(record)}
			subLabel={crashDetails(record, plugin?.name)}
			icon={<Discord.TableRowIcon source={icons.BugIcon ?? icons.WarningIcon} />}
			arrow
			onPress={() =>
				void reportCrashOnGitHub(
					record,
					plugin && { name: plugin.name, addon: crashReportAddon(plugin) },
					(found) => onLinked(record.at, found),
				)
			}
			onLongPress={record.issue ? () => copyIssueLink(record.issue!) : undefined}
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
