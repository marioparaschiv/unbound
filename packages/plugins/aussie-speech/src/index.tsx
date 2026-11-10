import { runFeatures } from '@unbound-plugins/shared/lifecycle/features';

import { startTranslation, isTranslating } from '~/translation';
import { translate } from '~/translation/translator';

export const { start, stop, selfTest } = runFeatures([startTranslation], {
	selfTest() {
		const translated = translate('thank you');
		const ok = isTranslating() && translated !== 'thank you';

		return {
			ok,
			detail: `${isTranslating() ? 'patched' : 'not patched'} sending, "thank you" became "${translated}"`,
		};
	},
});
