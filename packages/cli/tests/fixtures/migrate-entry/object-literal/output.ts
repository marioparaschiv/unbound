import { featureSelfTest } from '@unbound-plugins/shared/lifecycle/health';

export function start() {
	patch();
}

const stop = () => unpatch();

export { stop, featureSelfTest as selfTest };
