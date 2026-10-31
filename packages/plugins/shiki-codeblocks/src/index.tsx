import ensureCapabilities from '@unbound-plugins/shared/native/ensure-capabilities';
import applyFeatures from '@unbound-plugins/shared/lifecycle/apply-features';
import ensureClasses from '@unbound-plugins/shared/native/ios/ensure-classes';
import ensureModules from '@unbound-plugins/shared/metro/ensure-modules';
import type { PluginContext } from '@unbound-app/api/native';
import { messageTextViewClass } from '@unbound-plugins/shared/native/ios/text-attachments';

import SettingsPanel from '~/components/settings-panel';
import { MessageStore, SelectedChannelStore } from '~/modules';
import { createAndroidCards } from '~/android/cards';
import { createNativeCards } from '~/android/native-cards';
import { cardProgress, misplacedCards, startRenderer } from '~/ios/renderer';
import { PLUGIN_NAME } from '~/constants';
import { createHighlighter } from '~/highlighter';
import { readPreferences } from '~/preferences';

let dispose: () => Promise<void> | undefined = () => undefined;
let running = false;
let progress: () => { drawn: number; settling: boolean } = () => ({ drawn: 0, settling: false });

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
			progress = cards.progress;
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
	progress = cardProgress;
	running = true;
}

function stop() {
	const finished = dispose();

	dispose = () => undefined;
	running = false;
	progress = () => ({ drawn: 0, settling: false });

	return finished;
}

async function selfTest() {
	const { theme, hljs } = readPreferences();
	const tokens = await createHighlighter()
		.tokenize({ code: 'const answer: number = 42;', language: 'typescript' }, theme, hljs)
		.catch(() => null);
	const colors = new Set(tokens?.flat().map((token) => token.color)).size;
	const misplaced = await misplacedCards();

	if (misplaced.length) {
		return {
			ok: false,
			detail: `${misplaced.length} cards are on the wrong message: ${misplaced.slice(0, 2).join('; ')}`,
		};
	}

	const { drawn, settling } = progress();

	return {
		ok: running && colors > 1,
		detail: `${running ? `${drawn} cards drawn` : 'cards not running'}, sample TypeScript in ${theme} used ${colors} colors`,
		...(drawn ? {} : { nothingDrawn: true }),
		...(settling ? { settling: true } : {}),
	};
}

export default {
	start,
	stop,
	selfTest,
	getSettingsPanel: () => <SettingsPanel />,
};
