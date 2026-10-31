import { init, destroy } from '~/i18n/api';

/** Loads Unbound's translations for the active locale and follows locale changes. */
export function start() {
	void init();
}

/** Stops following locale changes. */
export function stop() {
	destroy();
}

export default { start, stop };
