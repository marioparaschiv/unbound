import showReadingLines from '@unbound-plugins/shared/messages/reading-lines';
import type { PluginContext } from '@unbound-app/api/native';

import { furiganaLine, needsFurigana } from '~/lib/furigana';
import { japaneseTokens } from '~/native/tokens';

let hideReadings: (() => void) | undefined;

export function start(context: PluginContext) {
	hideReadings = showReadingLines(
		{
			needs: needsFurigana,
			read: async (text) => {
				const tokens = await japaneseTokens(context.native, text);

				return tokens?.length ? furiganaLine(text, tokens) : undefined;
			},
		},
		(text, error) =>
			logger.error(`Failed to read the furigana of "${text.slice(0, 20)}":`, error),
	);

	if (!hideReadings) logger.warn('Furigana skipped: Discord moved RowManager.');
}

export function stop() {
	hideReadings?.();
	hideReadings = undefined;
}
