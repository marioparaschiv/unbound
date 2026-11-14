import type { PluginContext } from '@unbound-app/api/native';

import type { PrivacyScreen } from '~/native/privacy-screen';
import { startPrivacyScreen } from '~/native/privacy';

let privacy: PrivacyScreen | undefined;

export function start(context: PluginContext) {
	privacy = startPrivacyScreen(context.native);
}

export function stop() {
	privacy?.stop();
	privacy = undefined;
}

export function selfTest() {
	return privacy?.test() ?? { ok: false, detail: 'not started' };
}
