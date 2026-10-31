import applyFeatures from '@unbound-plugins/shared/lifecycle/apply-features';
import ensureModules from '@unbound-plugins/shared/metro/ensure-modules';
import { applyRules } from '@unbound-plugins/shared/text-replace/rules';

import { isPatched, patchMessageActions } from '~/patches/message-actions';
import SettingsPanel from '~/components/settings-panel';
import { normalizeStoredRules } from '~/stored-rules';
import { Messages } from '~/modules';

let dispose = () => {};

function start() {
	normalizeStoredRules();

	if (!ensureModules('Text Replace', { Messages })) return;

	dispose = applyFeatures('Text Replace', [patchMessageActions]);
}

function stop() {
	dispose();
	dispose = () => {};
}

const SAMPLE_RULE = { id: 'self-test', find: 'teh', replace: 'the', onlyIfIncludes: '' };

function selfTest() {
	const replaced = applyRules('teh cat', [SAMPLE_RULE], []);
	const ok = isPatched() && replaced === 'the cat';

	return {
		ok,
		detail: `${isPatched() ? 'patched' : 'not patched'} sendMessage, sample rule gave "${replaced}"`,
	};
}

export default {
	start,
	stop,
	selfTest,
	getSettingsPanel: () => <SettingsPanel />,
};
