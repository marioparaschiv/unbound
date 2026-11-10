import { runFeatures } from '@unbound-plugins/shared/lifecycle/features';

import { patchedMethods, startCleanUrls } from '~/clean-urls';
import { cleanUrls, compileRules } from '~/clean-urls/rules';
import { DEFAULT_RULES } from '~/constants';

const SAMPLE = 'https://example.com/a?utm_source=x&id=7&fbclid=y';
const CLEANED = 'https://example.com/a?id=7';

export const { start, stop, selfTest } = runFeatures([startCleanUrls], {
	selfTest() {
		const methods = patchedMethods();
		const cleaned = cleanUrls(SAMPLE, compileRules(DEFAULT_RULES));
		const ok = methods.length > 0 && cleaned === CLEANED;

		return {
			ok,
			detail: `patched ${methods.join(', ') || 'nothing'}, sample link ${cleaned === CLEANED ? 'cleaned' : `came out as ${cleaned}`}`,
		};
	},
});
