import type { Font, UnboundDiscordFamily } from '@unbound-app/types';
import { describe, expect, test } from 'bun:test';

import {
	groupSlots,
	nearestFace,
	nearestSlot,
	slotCoordinates,
	variableFace,
	type FontSlot,
} from '~/fonts/slots';

function family(groups: string[], weight: number, italic = false): UnboundDiscordFamily {
	return { groups, weight, style: italic ? 'italic' : 'normal' };
}

function face(id: string, weight: number, italic = false): Font {
	return {
		id,
		family: 'Inter',
		postScriptName: id,
		fullName: id,
		weight,
		style: italic ? 'italic' : 'normal',
		file: `${id}.ttf`,
		source: { google: 'Inter' },
	};
}

const FAMILIES = {
	'ggsans-Bold': family(['PRIMARY', 'DISPLAY'], 700),
	'NotoSans-Bold': family(['PRIMARY', 'DISPLAY'], 700),
	'ggsans-NormalItalic': family(['PRIMARY'], 400, true),
	'ggsans-Normal': family(['PRIMARY', 'DISPLAY'], 400),
	'SourceCodePro-Normal': family(['CODE'], 400),
};

describe('font slots', () => {
	test('a group splits into weights, upright before italic, fallbacks sharing a slot', () => {
		const bold = face('Inter-Bold', 700);
		const slots = groupSlots('PRIMARY', FAMILIES, (name) =>
			name === 'ggsans-Bold' ? bold : undefined,
		);

		expect(slots.map((slot) => [slot.key, slot.families])).toEqual([
			['400', ['ggsans-Normal']],
			['700', ['ggsans-Bold', 'NotoSans-Bold']],
			['400-italic', ['ggsans-NormalItalic']],
		]);
		expect(slots[1]?.face).toBe(bold);
		expect(slots[0]?.face).toBeUndefined();
	});

	test('the slot standing for a group is the upright one nearest the weight', () => {
		const slots = groupSlots('PRIMARY', FAMILIES, () => undefined);

		expect(nearestSlot(slots, 600)?.key).toBe('700');
		expect(nearestSlot(slots, 400)?.key).toBe('400');
		expect(nearestSlot([], 400)).toBeUndefined();
	});

	test('a style mismatch costs more than any weight gap', () => {
		const faces = [face('Inter-Thin', 100), face('Inter-BoldItalic', 700, true)];

		expect(nearestFace(faces, 700)?.id).toBe('Inter-Thin');
		expect(nearestFace(faces, 400, true)?.id).toBe('Inter-BoldItalic');
		expect(nearestFace([], 400)).toBeUndefined();
	});

	const AXES = [
		{ tag: 'wght', name: 'Weight', min: 100, default: 400, max: 900, hidden: false },
		{ tag: 'wdth', name: 'Width', min: 75, default: 100, max: 100, hidden: false },
	];

	function variable(id: string, weight: number, wdth = 100): Font {
		return { ...face(id, weight), axes: AXES, variations: { wght: weight, wdth } };
	}

	function slot(weight: number, drawn?: Font): FontSlot {
		return { key: String(weight), weight, italic: false, families: ['ggsans'], face: drawn };
	}

	test('axes are set on the variable face drawing a slot, else the nearest variable one', () => {
		const bold = variable('Vector-Bold', 700);
		const light = variable('Vector-Light', 300);
		const stat = face('Inter-Bold', 700);

		expect(variableFace(slot(700, bold), [light])).toBe(bold);
		expect(variableFace(slot(700, stat), [stat, light, bold])).toBe(bold);
		expect(variableFace(slot(700, stat), [stat])).toBeUndefined();
	});

	test("a slot sits at its face's coordinates, else at its weight on the defaults", () => {
		const narrow = variable('Vector-Narrow', 650, 80);

		expect(slotCoordinates(slot(700, narrow), narrow)).toEqual({ wght: 650, wdth: 80 });
		expect(slotCoordinates(slot(500), narrow)).toEqual({ wght: 500, wdth: 100 });
		expect(slotCoordinates(slot(1000), narrow)).toEqual({ wght: 900, wdth: 100 });
	});
});
