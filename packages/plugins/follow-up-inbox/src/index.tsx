import { listenToReplies } from '~/flux/listeners';
import { registerFollowUps } from '~/commands';
import { patchActionSheets } from '~/patches';

export function start() {
	patchActionSheets();
	listenToReplies();
	registerFollowUps();
}
