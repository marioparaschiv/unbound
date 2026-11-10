import { installDependencies } from '~/marketplace/install-dependencies';
import { countInstall } from '~/marketplace/count-install';
import { brokenDependents } from '~/addons/dependencies';
import type { UpdatableKind } from '~/addons/manager-of';
import type { AvailableChoice } from '~/addons/versions';
import { compareVersions } from '~/core/versions';
import { confirmText } from '~/dialogs/feedback';
import { messages, format } from '~/i18n/api';
import { Manager } from '~/addons/manager';
import { showDialog } from '~/dialogs/api';
import { ActionSheets } from '~/metro/api';
import { show } from '~/toasts/api';

import VersionPickerSheet from './version-picker-sheet';

/** The listed addon a version is picked for. */
export type VersionTarget = {
	kind: UpdatableKind;
	id: string;
	name: string;
};

const SHEET_KEY = 'unbound-addon-versions';

/**
 * @description Asks before a version choice that pauses updates, goes back a version or breaks a dependent;
 * an upgrade to the latest just installs.
 * @param target The addon the version is for.
 * @param choice The picked version.
 * @returns Whether to install it.
 */
export function confirmChoice(target: VersionTarget, choice: AvailableChoice): Promise<boolean> {
	const { kind, id, name } = target;
	const { version } = choice.version;
	const installed = Manager.for(kind).getEntity(id)?.version;
	const broken = brokenDependents(id, version, Manager.for(kind).getEntities());
	const downgrade = installed !== void 0 && compareVersions(version, installed) < 0;

	if (!choice.holds && !downgrade && broken.length === 0) {
		return Promise.resolve(true);
	}

	const lines = [
		choice.holds ? format('UNBOUND_VERSION_CONFIRM_HOLD', { name }) : null,
		downgrade ? format('UNBOUND_VERSION_CONFIRM_DOWNGRADE', { installed }) : null,
		broken.length > 0
			? format('UNBOUND_VERSION_CONFIRM_BROKEN', {
					names: broken.map((dependent) => dependent.manifest.name).join(', '),
				})
			: null,
	];

	// The body joins whichever warnings apply, so it is composed here rather than one message key.
	return confirmText(showDialog, {
		title: format('UNBOUND_VERSION_CONFIRM_TITLE', { name, version }),
		body: lines.filter(Boolean).join('\n\n'),
		confirm: messages.UNBOUND_INSTALL,
		cancel: messages.UNBOUND_CANCEL,
	});
}

/**
 * @description Installs a picked version, plugins' dependencies first and enabling a first install, then
 * toasts a failure or the hold it leaves.
 * @param target The addon the version is for.
 * @param choice The picked version.
 * @returns Whether the addon now runs the version.
 */
export async function installChoice(
	target: VersionTarget,
	choice: AvailableChoice,
): Promise<boolean> {
	const { kind, id, name } = target;
	const vars = { name, version: choice.version.version };
	const manager = Manager.for(kind);
	const fresh = !manager.getEntity(id);
	const ok =
		(kind !== 'plugin' || (await installDependencies(choice.version.manifest))) &&
		(await manager.installListed({ id }, choice.version, choice.holds));

	if (!ok) {
		show({ title: name, content: format('UNBOUND_VERSION_FAILED', vars), icon: 'CircleXIcon' });

		return false;
	}

	if (fresh) {
		countInstall(id);
		await manager.enable(id);
	}

	if (choice.holds) {
		show({
			title: name,
			content: format('UNBOUND_VERSION_HELD_TOAST', vars),
			icon: 'CircleCheckIcon',
		});
	}

	return true;
}

/**
 * @description Opens the sheet listing every live version of an addon.
 * @param target The addon whose versions to list.
 * @param onPick Runs with the chosen version once the sheet closes.
 */
export function openVersionPicker(
	target: VersionTarget,
	onPick: (choice: AvailableChoice) => void,
): void {
	ActionSheets.openLazy(Promise.resolve({ default: VersionPickerSheet }), SHEET_KEY, {
		...target,
		onPick,
		onClose: () => ActionSheets.hideActionSheet(SHEET_KEY),
	});
}

export default { confirmChoice, installChoice, openVersionPicker };
