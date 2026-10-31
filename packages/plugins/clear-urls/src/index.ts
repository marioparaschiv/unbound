import applyFeatures from '@unbound-plugins/shared/lifecycle/apply-features';
import ensureModules from '@unbound-plugins/shared/metro/ensure-modules';

import { patchedMethods, patchMessageActions } from '~/patches/message-actions';
import { cleanUrls, compileRules } from '~/clean-urls';
import { DEFAULT_RULES } from '~/constants';
import { MessageActions } from '~/modules';

let dispose = () => {};

function start() {
	if (!ensureModules('Clear URLs', { MessageActions })) return;

	dispose = applyFeatures('Clear URLs', [patchMessageActions]);
}

function stop() {
	dispose();
	dispose = () => {};
}

const SAMPLE = 'https://example.com/a?utm_source=x&id=7&fbclid=y';
const CLEANED = 'https://example.com/a?id=7';

function selfTest() {
	const methods = patchedMethods();
	const cleaned = cleanUrls(SAMPLE, compileRules(DEFAULT_RULES));
	const ok = methods.length > 0 && cleaned === CLEANED;

	return {
		ok,
		detail: `patched ${methods.join(', ') || 'nothing'}, sample link ${cleaned === CLEANED ? 'cleaned' : `came out as ${cleaned}`}`,
	};
}

export default { start, stop, selfTest };
