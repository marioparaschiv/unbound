import applyFeatures from '@unbound-plugins/shared/lifecycle/apply-features';
import ensureModules from '@unbound-plugins/shared/metro/ensure-modules';
import { metro } from '@unbound-app/api';

import { isTranslating, startTranslation } from '~/translation';
import { translate } from '~/translation/translator';

let dispose = () => {};

function start() {
	if (!ensureModules('Aussie Speech', { Messages: metro.api.Messages })) return;

	dispose = applyFeatures('Aussie Speech', [startTranslation]);
}

function stop() {
	dispose();
	dispose = () => {};
}

function selfTest() {
	const translated = translate('thank you');
	const ok = isTranslating() && translated !== 'thank you';

	return {
		ok,
		detail: `${isTranslating() ? 'patched' : 'not patched'} sending, "thank you" became "${translated}"`,
	};
}

export default { start, stop, selfTest };
