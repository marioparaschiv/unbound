import { patcher } from '@unbound-app/api';

import { isTranslating, patchMessageActions } from '~/patches';
import { translate } from '~/lib/translator';

export function start() {
	patchMessageActions();
}

export function stop() {
	patcher.unpatchAll();
}

export function selfTest() {
	const translated = translate('thank you');
	const ok = isTranslating() && translated !== 'thank you';

	return {
		ok,
		detail: `${isTranslating() ? 'patched' : 'not patched'} sending, "thank you" became "${translated}"`,
	};
}
