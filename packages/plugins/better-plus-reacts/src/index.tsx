import { patchReactionCommand, unpatchReactionCommand } from '~/patches';

export function start() {
	patchReactionCommand();
}

export function stop() {
	unpatchReactionCommand();
}
