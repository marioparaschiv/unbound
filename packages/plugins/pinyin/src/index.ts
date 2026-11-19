import showReadingLines from '@unbound-plugins/shared/messages/reading-lines';
import transliterate from '@unbound-plugins/shared/native/transliterate/transliterate';
import type { PluginContext } from '@unbound-app/api/native';

import { needsPinyin, pinyinLine } from '~/lib/chinese';

let hideReadings: (() => void) | undefined;

export function start(context: PluginContext) {
	hideReadings = showReadingLines(
		{
			needs: needsPinyin,
			read: async (text) => {
				const pinyin = await transliterate(context.native, text, 'Han-Latin');

				return pinyin ? pinyinLine(pinyin) : undefined;
			},
		},
		(text, error) =>
			logger.error(`Failed to read the pinyin of "${text.slice(0, 20)}":`, error),
	);

	if (!hideReadings) logger.warn('Pinyin skipped: Discord moved RowManager.');
}

export function stop() {
	hideReadings?.();
	hideReadings = undefined;
}
