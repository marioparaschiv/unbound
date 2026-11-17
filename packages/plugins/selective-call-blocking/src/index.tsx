import { silenceCalls } from '~/patches';
import SettingsPanel from '~/settings';

let letCallsRing: (() => void) | undefined;

export function start() {
	letCallsRing = silenceCalls();
}

export function stop() {
	letCallsRing?.();
	letCallsRing = undefined;
}

export { SettingsPanel };
