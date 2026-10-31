import applyFeatures from '@unbound-plugins/shared/lifecycle/apply-features';
import { featureSelfTest } from '@unbound-plugins/shared/lifecycle/health';
import ensureModules from '@unbound-plugins/shared/metro/ensure-modules';

import { patchContextMenus } from '~/patches/context-menus';
import { patchActionSheets, type SheetState } from '~/patches/action-sheets';
import { ActionSheets, Theme } from '~/modules';

function start() {
	if (!ensureModules('View Raw', { ActionSheets, Theme })) return;

	const state: SheetState = { open: null, profileUserId: null };

	applyFeatures('View Raw', [() => patchActionSheets(state), () => patchContextMenus(state)]);
}

export default { start, selfTest: featureSelfTest };
