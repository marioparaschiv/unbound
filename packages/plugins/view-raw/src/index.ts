import applyFeatures from '@unbound-plugins/shared/lifecycle/apply-features';
import ensureModules from '@unbound-plugins/shared/metro/ensure-modules';

import { patchContextMenus } from '~/patches/context-menus';
import { patchActionSheets, type SheetState } from '~/patches/action-sheets';
import { ActionSheets, Theme } from '~/modules';

let dispose = () => {};

function start() {
	if (!ensureModules('View Raw', { ActionSheets, Theme })) return;

	const state: SheetState = { open: null, profileUserId: null };

	dispose = applyFeatures('View Raw', [
		() => patchActionSheets(state),
		() => patchContextMenus(state),
	]);
}

function stop() {
	dispose();
	dispose = () => {};
}

export default { start, stop };
