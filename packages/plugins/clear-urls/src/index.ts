import ensureModules from '@unbound-plugins/shared/metro/ensure-modules';

import { patchedMethods, patchMessageActions } from '~/patches/message-actions';
import { cleanUrls, compileRules } from '~/clean-urls';
import { DEFAULT_RULES } from '~/constants';
import { MessageActions } from '~/modules';

function start() {
	if (!ensureModules('Clear URLs', { MessageActions })) return;

	patchMessageActions();
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

export default { start, selfTest };
