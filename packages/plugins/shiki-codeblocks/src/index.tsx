import ensureCapabilities from '@unbound-plugins/shared/native/ensure-capabilities';
import applyFeatures from '@unbound-plugins/shared/lifecycle/apply-features';
import ensureClasses from '@unbound-plugins/shared/native/ensure-classes';
import ensureModules from '@unbound-plugins/shared/metro/ensure-modules';
import type { PluginContext } from '@unbound-app/api/native';
import { messageTextViewClass } from '@unbound-plugins/shared/native/text-attachments';

import SettingsPanel from '~/components/settings-panel';
import { MessageStore, SelectedChannelStore } from '~/modules';
import { createAndroidCards } from '~/android/cards';
import { createNativeCards } from '~/android/native-cards';
import { startRenderer } from '~/native/renderer';
import { PLUGIN_NAME } from '~/constants';
import { createHighlighter } from '~/highlighter';
import { readPreferences } from '~/preferences';

let dispose: () => Promise<void> | undefined = () => undefined;
let running = false;

function start(context: PluginContext) {
	if (
		!ensureCapabilities(PLUGIN_NAME, context.native, context.capabilities) ||
		!ensureModules(PLUGIN_NAME, { MessageStore, SelectedChannelStore })
	) {
		return;
	}

	if (context.platform === 'android') {
		const cards = createNativeCards(context.native) ?? createAndroidCards(context.native);

		if (cards) {
			dispose = applyFeatures(PLUGIN_NAME, [() => cards.dispose]);
			running = true;
		}

		return;
	}

	if (
		!ensureClasses(PLUGIN_NAME, context.native.objc, [
			messageTextViewClass(context.native.objc),
			'DCDMessageTableViewCell',
		])
	) {
		return;
	}

	dispose = applyFeatures(PLUGIN_NAME, [() => startRenderer(context.native.objc)]);
	running = true;
}

function stop() {
	const finished = dispose();

	dispose = () => undefined;
	running = false;

	return finished;
}

async function selfTest() {
	const { theme, hljs } = readPreferences();
	const tokens = await createHighlighter()
		.tokenize({ code: 'const answer: number = 42;', language: 'typescript' }, theme, hljs)
		.catch(() => null);
	const colors = new Set(tokens?.flat().map((token) => token.color)).size;
	const ok = running && colors > 1;

	return {
		ok,
		detail: `${running ? 'cards running' : 'cards not running'}, sample TypeScript in ${theme} used ${colors} colors`,
	};
}

export default {
	start,
	stop,
	selfTest,
	getSettingsPanel: () => <SettingsPanel />,
};
