import { runFeatures } from '@unbound-plugins/shared/lifecycle/features';
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
import {
	ChannelStore,
	GuildMemberStore,
	GuildStore,
	RelationshipStore,
	UserStore,
} from '~/modules';

export const { start, stop, selfTest } = runFeatures(
	() => {
		if (
			!ensureModules({
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

		return [
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
		];
	},
	{ atomic: true },
);
