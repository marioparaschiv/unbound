import { startTranslation, isTranslating } from '~/translation';
import { translate } from '~/translation/translator';

export function start() {
	startTranslation();
}

export function selfTest() {
	const translated = translate('thank you');
	const ok = isTranslating() && translated !== 'thank you';

	return {
		ok,
		detail: `${isTranslating() ? 'patched' : 'not patched'} sending, "thank you" became "${translated}"`,
	};
}
