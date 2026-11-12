import { patcher } from '@unbound-app/api';

import {
	listenToChannelDelete,
	listenToConnectionOpen,
	listenToGuildDelete,
	listenToRelationshipRemove,
	listenToSnapshotChanges,
} from '~/flux/listeners';
import {
	patchGuildActions,
	patchPrivateChannelActions,
	patchRelationshipActions,
	patchRest,
} from '~/patches';
import { closeSession, openSession } from '~/lib/session';
import { scheduleStartCheck } from '~/lib/checks';

export function start() {
	openSession();
	patchRelationshipActions();
	patchGuildActions();
	patchPrivateChannelActions();
	patchRest();
	listenToSnapshotChanges();
	listenToGuildDelete();
	listenToChannelDelete();
	listenToRelationshipRemove();
	listenToConnectionOpen();
	scheduleStartCheck();
}

export async function stop() {
	patcher.unpatchAll();
	await closeSession();
}
