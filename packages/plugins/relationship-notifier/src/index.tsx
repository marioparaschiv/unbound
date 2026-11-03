import applyFeatures from '@unbound-plugins/shared/lifecycle/apply-features';
import { featureSelfTest } from '@unbound-plugins/shared/lifecycle/health';
import ensureModules from '@unbound-plugins/shared/metro/ensure-modules';

import { subscribeRelationshipRemove } from '~/events/relationship-remove';
import { subscribeSnapshotChanges } from '~/events/snapshot-changes';
import { subscribeConnectionOpen } from '~/events/connection-open';
import { subscribeChannelDelete } from '~/events/channel-delete';
import { subscribeGuildDelete } from '~/events/guild-delete';
import { scheduleStartCheck } from '~/events/start-check';
import { patchPrivateChannelActions } from '~/patches/private-channel-actions';
import { patchRelationshipActions } from '~/patches/relationship-actions';
import { patchGuildActions } from '~/patches/guild-actions';
import { patchRestRemovals } from '~/patches/rest-removals';
import { closeSession, createSession } from '~/session';
import SettingsPanel from '~/components/settings-panel';
import { PLUGIN_NAME } from '~/constants';
import {
	ChannelStore,
	GuildMemberStore,
	GuildStore,
	RelationshipStore,
	UserStore,
} from '~/modules';

let dispose: () => Promise<void> | undefined = () => undefined;

function start() {
	if (
		!ensureModules(PLUGIN_NAME, {
			UserStore,
			GuildStore,
			GuildMemberStore,
			ChannelStore,
			RelationshipStore,
		})
	) {
		return;
	}

	const session = createSession();

	dispose = applyFeatures(PLUGIN_NAME, [
		() => () => closeSession(session),
		() => patchRelationshipActions(session),
		() => patchGuildActions(session),
		() => patchPrivateChannelActions(session),
		() => patchRestRemovals(session),
		() => subscribeSnapshotChanges(session),
		() => subscribeGuildDelete(session),
		() => subscribeChannelDelete(session),
		() => subscribeRelationshipRemove(session),
		() => subscribeConnectionOpen(session),
		() => scheduleStartCheck(session),
	]);
}

function stop() {
	const pending = dispose();

	dispose = () => undefined;

	return pending;
}

export default {
	start,
	stop,
	selfTest: featureSelfTest,
	getSettingsPanel: () => <SettingsPanel />,
};
