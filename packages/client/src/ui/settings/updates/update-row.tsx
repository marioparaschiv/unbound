import type { InstalledEntry, PendingUpdate } from '~/updates/addon-updates';
import { messages, format } from '~/i18n/api';
import { Discord } from '~/metro/components';
import { Manager } from '~/addons/manager';
import { icons } from '~/assets/api';

import { openAddonChangelog } from './open-addon-changelog';
import { openAddonActions } from './addon-actions';
import UpdateButton from './update-button';
import StatusIcon from './status-icon';

type UpdateRowProps = {
	entry: InstalledEntry;
	/** Its pending update, if the last check found one. */
	update: PendingUpdate | undefined;
	/** Whether the last check finished, so an addon without an update is known to be current. */
	checked: boolean;
	/** Whether the Marketplace lists it; an unlisted addon never updates. */
	listed: boolean;
};

function describe(
	entry: InstalledEntry,
	update: PendingUpdate | undefined,
	held: boolean,
	listed: boolean,
) {
	if (update) {
		const jump = `v${entry.version} → v${update.update.version}`;

		return held ? `${jump} · ${messages.UNBOUND_UPDATES_PAUSED}` : jump;
	}

	if (!listed) {
		return format('UNBOUND_UPDATES_VERSION_UNLISTED', { version: entry.version });
	}

	return held
		? format('UNBOUND_UPDATES_VERSION_PAUSED', { version: entry.version })
		: `v${entry.version}`;
}

/**
 * @description One installed addon: its version and whether it is current, paused, unlisted or has an
 * update. Pressing a listed one opens its update, version and pause actions.
 */
function UpdateRow({ entry, update, checked, listed }: UpdateRowProps) {
	const navigation = Discord.useNavigation();
	const manager = Manager.for(entry.kind);
	const held = manager.getHeldVersion(entry.id) !== void 0;
	const icon = icons[manager.icon];

	function trailing() {
		if (update) {
			return <UpdateButton id={entry.id} text={messages.UNBOUND_UPDATE} />;
		}

		if (!listed) {
			return undefined;
		}

		if (held) {
			return <StatusIcon variant='paused' />;
		}

		return checked ? <StatusIcon variant='current' /> : undefined;
	}

	function openChangelog() {
		if (update) {
			openAddonChangelog(navigation, update);
		}
	}

	return (
		<Discord.TableRow
			label={entry.name}
			subLabel={describe(entry, update, held, listed)}
			labelLineClamp={1}
			subLabelLineClamp={1}
			icon={<Discord.TableRowIcon source={icon} />}
			trailing={trailing()}
			onPress={
				listed || update
					? () => openAddonActions({ entry, update, openChangelog })
					: undefined
			}
		/>
	);
}

export default UpdateRow;
