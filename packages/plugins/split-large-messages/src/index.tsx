import { patchLengthCheck, patchSendMessage } from '~/patches';

export function start() {
	patchLengthCheck();
	patchSendMessage();
}
