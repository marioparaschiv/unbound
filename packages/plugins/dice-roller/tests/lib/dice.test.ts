import { describe, expect, test } from 'bun:test';

import { DiceError, formatRoll, parseDice, rollDice } from '~/lib/dice';

function sequence(...faces: number[]) {
	let index = 0;

	return (sides: number) => {
		const face = faces[index++ % faces.length]!;

		return Math.min(face, sides);
	};
}

describe('parsing dice', () => {
	test('reads dice, keep and drop modifiers, and constants', () => {
		expect(parseDice('2d20kh1+5')).toEqual([
			{
				kind: 'dice',
				sign: 1,
				count: 2,
				sides: 20,
				keep: { mode: 'kh', amount: 1 },
				explode: false,
			},
			{ kind: 'constant', sign: 1, value: 5 },
		]);
		expect(parseDice('d% - 2 + 4d6dl1')).toEqual([
			{ kind: 'dice', sign: 1, count: 1, sides: 100, explode: false },
			{ kind: 'constant', sign: -1, value: 2 },
			{
				kind: 'dice',
				sign: 1,
				count: 4,
				sides: 6,
				keep: { mode: 'dl', amount: 1 },
				explode: false,
			},
		]);
		expect(parseDice('3d6!')).toEqual([
			{ kind: 'dice', sign: 1, count: 3, sides: 6, explode: true },
		]);
	});

	test('treats a bare k as keep highest', () => {
		expect(parseDice('4d6k3')[0]).toMatchObject({ keep: { mode: 'kh', amount: 3 } });
	});

	test('rejects what it cannot roll', () => {
		for (const bad of ['', 'banana', '2d', '0d6', '2d1!', '1001d6', '2d6kh3', '2d6 5', '+']) {
			expect(() => parseDice(bad)).toThrow(DiceError);
		}
	});
});

describe('rolling dice', () => {
	test('keeps the highest die and adds the constant', () => {
		const roll = rollDice(parseDice('2d20kh1+5'), sequence(17, 4));

		expect(roll.total).toBe(22);
		expect(roll.terms[0]).toMatchObject({
			dice: [
				{ face: 17, kept: true },
				{ face: 4, kept: false },
			],
			subtotal: 17,
		});
	});

	test('drops the lowest and subtracts', () => {
		const roll = rollDice(parseDice('4d6dl1-1'), sequence(3, 1, 6, 5));

		expect(roll.total).toBe(13);
	});

	test('rerolls exploding dice into extra dice', () => {
		const roll = rollDice(parseDice('1d6!'), sequence(6, 6, 2));

		expect(roll.terms[0]?.dice.map((die) => die.face)).toEqual([6, 6, 2]);
		expect(roll.total).toBe(14);
	});
});

describe('formatting a roll', () => {
	test('shows every die, strikes dropped ones, and bolds the total', () => {
		const roll = rollDice(parseDice('2d20kh1+5'), sequence(17, 4));

		expect(formatRoll('2d20kh1+5', roll)).toBe('🎲 `2d20kh1+5`: [17, ~~4~~] + 5 = **22**');
	});

	test('writes negative terms with a minus', () => {
		const roll = rollDice(parseDice('1d4-2'), sequence(3));

		expect(formatRoll('1d4-2', roll)).toBe('🎲 `1d4-2`: [3] - 2 = **1**');
	});
});
