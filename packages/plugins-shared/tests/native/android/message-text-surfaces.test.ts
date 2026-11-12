import { installAddonGlobals } from '@unbound-app/api/testing/fakes';
import { afterEach, describe, expect, test } from 'bun:test';

import {
	createMessageTextSurfaces,
	type MessageTextSurfaces,
	type TextSurfaceSlot,
} from '~/native/android/message-text-surfaces';

import { fakeMessageText, settle, type RewriteCall } from '../../helpers/fake-message-text';

installAddonGlobals();

const TWO_SLOTS = 'a [x] b [yy] c';
const PLACEHOLDER = '\uFFFC';

type Laid = { surfaceId: string; width: number };

let surfaces: MessageTextSurfaces | undefined;

afterEach(async () => {
	await surfaces?.dispose();
	surfaces = undefined;
});

// Replaces each bracketed token with a placeholder, keeping a `P` before the first one.
function bracketSlots(string: string): TextSurfaceSlot[] {
	return [...string.matchAll(/\[\w+\]/g)].map((match, index) => ({
		start: match.index,
		end: match.index + match[0].length,
		text: index === 0 ? `P${PLACEHOLDER}` : PLACEHOLDER,
		placeholder: index === 0 ? 1 : 0,
		gap: index === 0 ? 2 : 0,
	}));
}

function start(android: ReturnType<typeof fakeMessageText>, height = () => 20) {
	const laid: Laid[] = [];
	const offered: string[] = [];

	surfaces = createMessageTextSurfaces(android.native, {
		surfaceModule: 'Card',
		prefix: 'card',
		async slots({ string }) {
			offered.push(string);

			return bracketSlots(string);
		},
		async layout(surfaceId, _slot, width) {
			laid.push({ surfaceId, width });

			return height();
		},
	});

	return { laid, offered };
}

function json(call: RewriteCall, index: number) {
	const arg = call.args[index];

	return typeof arg === 'string' ? JSON.parse(arg) : undefined;
}

describe('createMessageTextSurfaces', () => {
	test('is unavailable when the loader has no native text rewrites', () => {
		start(fakeMessageText({ rewrites: false }));

		expect(surfaces).toBeUndefined();
	});

	test('rewrites the slots of a text Discord sets and places a surface over each placeholder', async () => {
		const android = fakeMessageText();
		const { laid } = start(android);

		android.setText(android.contentView(500), TWO_SLOTS);
		await settle();

		// 500 px wide less 20 px of padding, at density 2.
		expect(laid).toEqual([
			{ surfaceId: 'card-0', width: 240 },
			{ surfaceId: 'card-1', width: 240 },
		]);

		const [put] = android.callsTo('put');

		expect(put?.args.slice(0, 2)).toEqual([TWO_SLOTS, `a P${PLACEHOLDER} b ${PLACEHOLDER} c`]);
		expect(json(put, 2)).toEqual([
			{ start: 2, end: 5, text: `P${PLACEHOLDER}`, spacerOffset: 1, width: 480, height: 44 },
			{ start: 8, end: 12, text: PLACEHOLDER, spacerOffset: 0, width: 480, height: 40 },
		]);
		expect(
			android.callsTo('addHost').map((call) => [call.args[0], json(call, 3).placeholder]),
		).toEqual([
			['card-0', 3],
			['card-0', 7],
			['card-1', 3],
			['card-1', 7],
		]);
		expect(surfaces?.drawn()).toBe(1);
	});

	test('leaves a text without slots as Discord set it', async () => {
		const android = fakeMessageText();
		const { offered } = start(android);

		android.setText(android.contentView(), 'plain text');
		await settle();

		expect(offered).toEqual(['plain text']);
		expect(android.callsTo('put')).toEqual([]);
		expect(surfaces?.drawn()).toBe(0);
	});

	test('waits for a text view too narrow for a surface, then draws once it is resized', async () => {
		const android = fakeMessageText();
		const view = android.contentView(0);

		start(android);
		android.setText(view, TWO_SLOTS);
		await settle();

		expect(android.callsTo('put')).toEqual([]);
		expect(surfaces?.settling()).toBe(true);

		android.resize(view, 500);
		await settle();

		expect(android.callsTo('put')).toHaveLength(1);
		expect(surfaces?.settling()).toBe(false);
	});

	test('lays out again only the text holding the surface a redraw names', async () => {
		const android = fakeMessageText();
		let height = 20;
		const { laid } = start(android, () => height);

		android.setText(android.contentView(), 'first [x]');
		android.setText(android.contentView(), 'second [y]');
		await settle();
		height = 30;
		surfaces?.redraw('card-1');
		await settle();

		expect(laid.map((each) => each.surfaceId)).toEqual(['card-0', 'card-1', 'card-1']);
		expect(android.callsTo('put').map((call) => call.args[0])).toEqual([
			'first [x]',
			'second [y]',
			'second [y]',
		]);
		expect(android.callsTo('updateAnchor').map((call) => json(call, 1).height)).toEqual([
			60, 60,
		]);
	});

	test('removes its rules and surfaces on dispose, and draws no text set after', async () => {
		const android = fakeMessageText();
		const { offered } = start(android);

		android.setText(android.contentView(), TWO_SLOTS);
		await settle();
		await surfaces?.dispose();
		surfaces = undefined;
		android.setText(android.contentView(), 'late [z]');
		await settle();

		expect(android.callsTo('remove').map((call) => call.args)).toEqual([[TWO_SLOTS]]);
		expect(android.callsTo('dispose')).toHaveLength(1);
		expect(android.callsTo('removeGroup').map((call) => call.args[0])).toEqual([
			'card-0',
			'card-1',
		]);
		expect(android.unmounted.toSorted()).toEqual(android.mounted.toSorted());
		expect(android.mounted).toHaveLength(4);
		expect(offered).toEqual([TWO_SLOTS]);
	});
});
