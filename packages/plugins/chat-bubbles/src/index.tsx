import ensureCapabilities from '@unbound-plugins/shared/native/ensure-capabilities';
import type { PluginContext } from '@unbound-app/api/native';

import SettingsPanel from '~/components/settings-panel';
import { subscribeAppearance } from '~/theme';
import { drawAndroidBubbles } from '~/android';
import { drawIOSBubbles } from '~/ios';
import { PLUGIN_NAME } from '~/constants';

let dispose: () => void | Promise<void> = () => {};
let placed: (() => number) | null = null;
let problems: (() => string[]) | null = null;

function start(context: PluginContext) {
	if (!ensureCapabilities(PLUGIN_NAME, context.native, context.capabilities)) return;

	const bubbles =
		context.platform === 'android'
			? drawAndroidBubbles(context.native)
			: drawIOSBubbles(context.native.objc);
	const unsubscribe = subscribeAppearance(() => bubbles.refresh());

	placed = bubbles.placed;
	problems = bubbles.problems;
	dispose = () => {
		unsubscribe();
		placed = null;
		problems = null;

		return bubbles.dispose();
	};
}

function stop() {
	const stopping = dispose();

	dispose = () => {};

	return stopping;
}

function selfTest() {
	if (!placed) {
		return { ok: false, detail: 'bubbles are not drawing' };
	}

	const found = problems?.() ?? [];

	if (found.length) {
		return {
			ok: false,
			detail: `${found.length} bubbles look wrong: ${found.slice(0, 3).join('; ')}`,
		};
	}

	return { ok: true, detail: `${placed()} bubbles placed on screen` };
}

export default {
	start,
	stop,
	selfTest,
	getSettingsPanel: () => <SettingsPanel />,
};
