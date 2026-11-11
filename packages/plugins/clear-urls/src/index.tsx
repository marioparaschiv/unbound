import { patcher } from '@unbound-app/api';

import { patchedMethods, patchMessageActions } from '~/patches';
import { cleanUrls, compileRules } from '~/lib/rules';
import { DEFAULT_RULES } from '~/constants';

const SAMPLE = 'https://example.com/a?utm_source=x&id=7&fbclid=y';
const CLEANED = 'https://example.com/a?id=7';

export function start() {
	patchMessageActions();
}

export function stop() {
	patcher.unpatchAll();
}

export function selfTest() {
	const methods = patchedMethods();
	const cleaned = cleanUrls(SAMPLE, compileRules(DEFAULT_RULES));
	const ok = methods.length > 0 && cleaned === CLEANED;

	return {
		ok,
		detail: `patched ${methods.join(', ') || 'nothing'}, sample link ${cleaned === CLEANED ? 'cleaned' : `came out as ${cleaned}`}`,
	};
}
