import ensureCapabilities from '@unbound-plugins/shared/native/ensure-capabilities';
import applyFeatures from '@unbound-plugins/shared/lifecycle/apply-features';
import ensureModules from '@unbound-plugins/shared/metro/ensure-modules';
import type { PluginContext } from '@unbound-app/api/native';

import SettingsPanel from '~/components/settings-panel';
import { MessageStore, SelectedChannelStore } from '~/modules';
import { createHighlighter } from '~/highlighter';
import { readPreferences } from '~/preferences';
import { PLUGIN_NAME } from '~/constants';
import { startCards } from '~/platform';
import type { Cards } from '~/types';

let dispose: () => Promise<void> | undefined = () => undefined;
let cards: Cards | undefined;

function start(context: PluginContext) {
	if (
		!ensureCapabilities(PLUGIN_NAME, context.native, context.capabilities) ||
		!ensureModules(PLUGIN_NAME, { MessageStore, SelectedChannelStore })
	) {
		return;
	}

	cards = startCards(context.native);

	if (cards) {
		dispose = applyFeatures(PLUGIN_NAME, [cards.feature]);
	}
}

function stop() {
	const finished = dispose();

	dispose = () => undefined;
	cards = undefined;

	return finished;
}

async function selfTest() {
	const { theme, hljs } = readPreferences();
	const tokens = await createHighlighter()
		.tokenize({ code: 'const answer: number = 42;', language: 'typescript' }, theme, hljs)
		.catch(() => null);
	const colors = new Set(tokens?.flat().map((token) => token.color)).size;
	const misplaced = (await cards?.misplaced()) ?? [];

	if (misplaced.length) {
		return {
			ok: false,
			detail: `${misplaced.length} cards are on the wrong message: ${misplaced.slice(0, 2).join('; ')}`,
		};
	}

	const { drawn, settling } = cards?.progress() ?? { drawn: 0, settling: false };

	return {
		ok: Boolean(cards) && colors > 1,
		detail: `${cards ? `${drawn} cards drawn` : 'cards not running'}, sample TypeScript in ${theme} used ${colors} colors`,
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
