import { metro, patcher, plugins } from '@unbound-app/api';

/** Where a reading line comes from: which message texts get one, and how to work it out. */
export type ReadingSource = {
	/** Whether a message's text has anything to read out. */
	needs(text: string): boolean;
	/** Works out the line shown under the message, or `undefined` for none. */
	read(text: string): Promise<string | undefined>;
};

type MessageRecord = { content?: string; set(key: string, value: string): MessageRecord };
type RowInput = { message?: MessageRecord };
type ChatRow = { message?: { content?: object[] } };
type RowGenerator = { generate(input: RowInput): ChatRow };

const SUBTEXT = '\n-# ';
const KEPT_READINGS = 500;

function isRowGenerator(value: object | undefined): value is RowGenerator {
	return typeof Reflect.get(Object(value), 'generate') === 'function';
}

/**
 * @description Shows a line under each chat message whose text needs a reading, such as its pinyin, as subtext.
 * Readings are worked out once per text in the background and the chat redraws when they land. Patches `generate`
 * on Discord's `RowManager`, the way inline translations draw.
 * @param source Which texts need a reading, and how to read them.
 * @param onFailure Told about a text whose reading failed.
 * @returns A function that forgets the readings and redraws the chat, or `undefined` when Discord moved `RowManager`.
 */
export function showReadingLines(
	source: ReadingSource,
	onFailure: (text: string, error: Error) => void,
): (() => void) | undefined {
	const RowManager = metro.findByName('RowManager');
	const prototype: object | undefined = Reflect.get(Object(RowManager), 'prototype');

	if (!isRowGenerator(prototype)) return undefined;

	const readings = new Map<string, string | null>();
	let generating = false;
	let stopped = false;

	function request(text: string) {
		if (readings.size >= KEPT_READINGS) readings.delete(readings.keys().next().value!);

		readings.set(text, null);
		source
			.read(text)
			.then((reading) => {
				if (stopped || !reading) return;

				readings.set(text, reading);
				plugins.redrawChat?.();
			})
			.catch((error: Error) => onFailure(text, error));
	}

	function withReading(generator: RowGenerator, input: RowInput, line: string) {
		const message = input.message;

		if (typeof message?.set !== 'function' || typeof message.content !== 'string') return null;

		generating = true;

		try {
			return generator.generate({
				...input,
				message: message.set('content', `${message.content}${SUBTEXT}${line}`),
			}).message?.content;
		} finally {
			generating = false;
		}
	}

	patcher.after(prototype, 'generate', ({ args: [input], result, this: self }) => {
		const row = result as ChatRow | undefined;
		const text = (input as RowInput | undefined)?.message?.content;

		if (generating || !row?.message || typeof text !== 'string' || !source.needs(text)) return;

		if (!readings.has(text)) {
			request(text);

			return;
		}

		const line = readings.get(text);
		const content =
			line && isRowGenerator(self) ? withReading(self, input as RowInput, line) : null;

		if (Array.isArray(content)) row.message.content = content;
	});

	return () => {
		stopped = true;
		readings.clear();
		plugins.redrawChat?.();
	};
}

export default showReadingLines;
