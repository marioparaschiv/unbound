import applyFeatures from '@unbound-plugins/shared/lifecycle/apply-features';
import { featureSelfTest } from '@unbound-plugins/shared/lifecycle/health';
import ensureModules from '@unbound-plugins/shared/metro/ensure-modules';

import {
	ChannelStore,
	GuildMemberStore,
	GuildStore,
	IconUtils,
	Media,
	UserProfileStore,
	UserStore,
} from '~/modules';
import { patchContextMenus } from '~/patches/context-menus';
import { patchActionSheets } from '~/patches/action-sheets';
import type { SheetRef } from '~/opened-sheet';

function start() {
	const ready = ensureModules('View Icons', {
		IconUtils,
		Media,
		ChannelStore,
		GuildMemberStore,
		GuildStore,
		UserProfileStore,
		UserStore,
	});

	if (!ready) return;

	const opened: SheetRef = { current: null };

	applyFeatures('View Icons', [() => patchActionSheets(opened), () => patchContextMenus(opened)]);
}

export default { start, selfTest: featureSelfTest };
