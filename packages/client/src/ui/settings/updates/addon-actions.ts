import { confirmChoice, installChoice, openVersionPicker } from '~/ui/marketplace/version-choice';
import type { InstalledEntry, PendingUpdate } from '~/updates/addon-updates';
import type { VersionTarget } from '~/ui/marketplace/version-choice';
import type { AvailableChoice } from '~/addons/versions';
import { messages, format } from '~/i18n/api';
import { Discord } from '~/metro/components';
import { Manager } from '~/addons/manager';
import UpdatesStore from '~/updates/state';
import { icons } from '~/assets/api';
import { show } from '~/toasts/api';

type AddonActionsOptions = {
	entry: InstalledEntry;
	/** The addon's pending update, if the last check found one. */
	update: PendingUpdate | undefined;
	openChangelog: () => void;
};

// A picked version changes what the last check offered, so it checks again.
async function pick(target: VersionTarget, choice: AvailableChoice) {
	if (!(await confirmChoice(target, choice))) return;

	if (await installChoice(target, choice)) {
		await UpdatesStore.getState().check();
	}
}

function pause(entry: InstalledEntry) {
	Manager.for(entry.kind).holdVersion(entry.id, entry.version);
	show({
		title: entry.name,
		content: format('UNBOUND_UPDATES_PAUSED_TOAST', {
			name: entry.name,
			version: entry.version,
		}),
		icon: 'PauseIcon',
	});
}

function resume(entry: InstalledEntry) {
	Manager.for(entry.kind).releaseHold(entry.id);
	show({
		title: entry.name,
		content: format('UNBOUND_UPDATES_RESUMED_TOAST', { name: entry.name }),
		icon: 'PlayIcon',
	});
}

/**
 * @description Opens an installed addon's update actions: update it and read what changed, pick any
 * version including an older one, and pause or resume its automatic updates.
 * @param options The addon, its pending update and the action that opens its changelog.
 */
export function openAddonActions({ entry, update, openChangelog }: AddonActionsOptions): void {
	const held = Manager.for(entry.kind).getHeldVersion(entry.id) !== void 0;
	const target = { kind: entry.kind, id: entry.id, name: entry.name };
	const updateOptions = update
		? [
				{
					label: format('UNBOUND_UPDATES_UPDATE_TO', { version: update.update.version }),
					icon: icons.DownloadIcon,
					onPress: () => void UpdatesStore.getState().apply(entry.id),
				},
				{
					label: messages.UNBOUND_UPDATES_CHANGELOG,
					icon: icons.PaperIcon,
					onPress: openChangelog,
				},
			]
		: [];

	Discord.showSimpleActionSheet({
		key: 'unbound-addon-update-actions',
		header: { title: entry.name },
		options: [
			...updateOptions,
			{
				label: messages.UNBOUND_CHOOSE_VERSION,
				icon: icons.ClockIcon,
				onPress: () => openVersionPicker(target, (choice) => void pick(target, choice)),
			},
			held
				? {
						label: messages.UNBOUND_UPDATES_RESUME,
						icon: icons.PlayIcon,
						onPress: () => resume(entry),
					}
				: {
						label: messages.UNBOUND_UPDATES_PAUSE,
						icon: icons.PauseIcon,
						onPress: () => pause(entry),
					},
		],
	});
}

export default { openAddonActions };
