import { init, destroy } from '~/api/i18n';

export function start() {
	void init();
}

export function stop() {
	destroy();
}

export default { start, stop };
