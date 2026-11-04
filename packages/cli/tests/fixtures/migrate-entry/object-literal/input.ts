import { featureSelfTest } from '@unbound-plugins/shared/lifecycle/health';

function start() {
	patch();
}

const stop = () => unpatch();

export default { start, stop, selfTest: featureSelfTest };
