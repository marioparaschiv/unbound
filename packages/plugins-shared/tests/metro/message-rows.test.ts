import { createRecordingPatcher, installAddonGlobals } from '@unbound-app/api/testing/fakes';
import { afterEach, describe, expect, mock, test } from 'bun:test';

import type { MessageRow, RowOptions } from '~/metro/message-rows';

type Message = { id: string; author?: { id?: string } };
type Input = { message?: Message };
type Options = RowOptions;

// Discord's builder, reduced to what the shared hook relies on: the row lands under `message`.
const rowModule = {
	generateMessageRowData: (input: Input, options?: Options, extra?: string) => ({
		message: { id: input.message?.id, options, extra },
	}),
};
const patcher = createRecordingPatcher();
const { logs } = installAddonGlobals();
let found: typeof rowModule | undefined = rowModule;

void mock.module('@unbound-app/api', () => ({
	metro: { findByProps: () => found },
	patcher,
}));

const { onMessageRow } = await import('~/metro/message-rows');

const build = (input: Input, options?: Options, extra?: string) =>
	rowModule.generateMessageRowData(input, options, extra).message;

afterEach(() => {
	patcher.unpatchAll();
	found = rowModule;
});

describe('onMessageRow', () => {
	test('hands an after handler the message, the options and the row Discord built', () => {
		const seen: unknown[] = [];

		onMessageRow<Message, MessageRow & { id?: string }>({
			after: ({ message, options, row }) => void seen.push([message?.id, options, row?.id]),
		});
		build({ message: { id: 'm1' } }, { animate: false });

		expect(seen).toEqual([['m1', { animate: false }, 'm1']]);
	});

	test('lets an after handler change the row in place', () => {
		onMessageRow<Message, MessageRow & { id?: string; label?: string }>({
			after: ({ row }) => {
				if (row) {
					row.label = 'changed';
				}
			},
		});

		expect(build({ message: { id: 'm1' } })).toMatchObject({ id: 'm1', label: 'changed' });
	});

	test('builds the row from what a before handler returns, keeping the rest of the call', () => {
		onMessageRow<Message>({
			before: ({ message, options }) =>
				message?.id === 'm1'
					? {
							input: { message: { id: 'swapped' } },
							options: { ...options, animate: true },
						}
					: undefined,
		});

		expect(build({ message: { id: 'm1' } }, { animate: false }, 'third')).toEqual({
			id: 'swapped',
			options: { animate: true },
			extra: 'third',
		});
		expect(build({ message: { id: 'm2' } }, { animate: false })).toEqual({
			id: 'm2',
			options: { animate: false },
			extra: undefined,
		});
	});

	test('reads no message or options from a call without them', () => {
		const seen: unknown[] = [];

		onMessageRow({ after: ({ message, options }) => void seen.push([message, options]) });
		build({});

		expect(seen).toEqual([[undefined, undefined]]);
	});

	test('removes both patches with the function it returns', () => {
		const seen: string[] = [];
		const stop = onMessageRow<Message>({
			before: () => void seen.push('before'),
			after: () => void seen.push('after'),
		});

		stop();
		build({ message: { id: 'm1' } });

		expect(seen).toEqual([]);
		expect(patcher.patches).toEqual([]);
	});

	test('warns once naming the feature and patches nothing when Discord moved the builder', () => {
		found = undefined;

		onMessageRow({ after: () => undefined, feature: 'Pronouns' });

		expect(patcher.patches).toEqual([]);
		expect(logs.at(-1)).toEqual({
			level: 'warn',
			args: ['Pronouns skipped: Discord moved generateMessageRowData.'],
		});
	});
});
