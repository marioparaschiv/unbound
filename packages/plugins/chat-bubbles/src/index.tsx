import ensureCapabilities from '@unbound-plugins/shared/native/ensure-capabilities';
import type { PluginContext } from '@unbound-app/api/native';

import SettingsPanel from '~/components/settings-panel';
import { subscribeAppearance } from '~/theme';
import { drawAndroidBubbles } from '~/android/bubbles';
import { drawIOSBubbles } from '~/ios/bubbles';
import { PLUGIN_NAME } from '~/constants';

let dispose: () => void | Promise<void> = () => {};
let placed: (() => number) | null = null;
let settling: (() => boolean) | null = null;
let problems: (() => string[] | Promise<string[]>) | null = null;

function start(context: PluginContext) {
	if (!ensureCapabilities(PLUGIN_NAME, context.native, context.capabilities)) return;

	const bubbles =
		context.platform === 'android'
			? drawAndroidBubbles(context.native)
			: drawIOSBubbles(context.native.objc);
	const unsubscribe = subscribeAppearance(() => bubbles.refresh());

	placed = bubbles.placed;
	settling = bubbles.settling;
	problems = bubbles.problems;
	dispose = () => {
		unsubscribe();
		placed = null;
		settling = null;
		problems = null;

		return bubbles.dispose();
	};
}

function stop() {
	const stopping = dispose();

	dispose = () => {};

	return stopping;
}

async function selfTest() {
	if (!placed) {
		return { ok: false, detail: 'bubbles are not drawing' };
	}

	const found = (await problems?.()) ?? [];

	if (found.length) {
		return {
			ok: false,
			detail: `${found.length} bubbles look wrong: ${found.slice(0, 3).join('; ')}`,
		};
	}

	const count = placed();

	return {
		ok: true,
		detail: `${count} bubbles placed on screen`,
		...(count ? {} : { nothingDrawn: true }),
		...(settling?.() ? { settling: true } : {}),
	};
}

export default {
	start,
	stop,
	selfTest,
	getSettingsPanel: () => <SettingsPanel />,
};
