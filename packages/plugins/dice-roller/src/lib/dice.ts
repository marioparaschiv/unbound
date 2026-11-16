const MAX_DICE = 1000;
const MAX_SIDES = 10000;
const MAX_EXPLOSIONS = 100;
const TERM = /^\s*([+-])?\s*(?:(\d*)d(\d+|%)(?:(kh|kl|dh|dl|k)(\d+))?(!)?|(\d+))\s*/i;

export type KeepMode = 'kh' | 'kl' | 'dh' | 'dl';

export type DiceTerm = {
	kind: 'dice';
	sign: 1 | -1;
	count: number;
	sides: number;
	keep?: { mode: KeepMode; amount: number };
	explode: boolean;
};

export type ConstantTerm = { kind: 'constant'; sign: 1 | -1; value: number };

export type Term = DiceTerm | ConstantTerm;

export type Die = { face: number; kept: boolean };

export type RolledTerm = { term: Term; dice: Die[]; subtotal: number };

export type Roll = { terms: RolledTerm[]; total: number };

export type RollFace = (sides: number) => number;

export type DiceErrorCode = 'EMPTY' | 'UNREADABLE' | 'DICE_COUNT' | 'SIDES' | 'KEEP_COUNT';

export class DiceError extends Error {
	override name = 'DiceError';

	constructor(
		readonly code: DiceErrorCode,
		readonly values: Record<string, string | number> = {},
	) {
		super(code);
	}
}

function diceTerm(
	sign: 1 | -1,
	count: number,
	sides: number,
	keep: string | undefined,
	amount: string | undefined,
	explode: boolean,
): DiceTerm {
	if (count < 1 || count > MAX_DICE) throw new DiceError('DICE_COUNT', { max: MAX_DICE });
	if (sides < 2 || sides > MAX_SIDES) throw new DiceError('SIDES', { max: MAX_SIDES });

	const term: DiceTerm = { kind: 'dice', sign, count, sides, explode };

	if (!keep) return term;

	const mode = (keep.toLowerCase() === 'k' ? 'kh' : keep.toLowerCase()) as KeepMode;
	const kept = Number(amount);

	if (kept < 1 || kept > count) throw new DiceError('KEEP_COUNT', { max: count });

	return { ...term, keep: { mode, amount: kept } };
}

/**
 * @description Reads a dice expression such as `2d20kh1+5`: dice (`NdS`, `d%`), keep or drop the highest or lowest
 * (`kh`, `kl`, `dh`, `dl`, `k`), exploding dice (`!`) and whole numbers, joined by `+` and `-`.
 * @param expression The expression.
 * @returns Its terms in order.
 */
export function parseDice(expression: string): Term[] {
	const terms: Term[] = [];
	let rest = expression.trim();

	if (!rest) throw new DiceError('EMPTY');

	while (rest) {
		const match = TERM.exec(rest);

		if (!match || (terms.length && !match[1]))
			throw new DiceError('UNREADABLE', { text: rest });

		const [whole, signText, count, sides, keep, amount, explode, constant] = match;
		const sign = signText === '-' ? -1 : 1;

		if (constant !== undefined) {
			terms.push({ kind: 'constant', sign, value: Number(constant) });
		} else {
			terms.push(
				diceTerm(
					sign,
					count ? Number(count) : 1,
					sides === '%' ? 100 : Number(sides),
					keep,
					amount,
					Boolean(explode),
				),
			);
		}

		rest = rest.slice(whole.length);
	}

	return terms;
}

function rollFaces({ count, sides, explode }: DiceTerm, face: RollFace): number[] {
	const faces: number[] = [];
	let remaining = count;
	let explosions = 0;

	while (remaining > 0) {
		const value = face(sides);

		faces.push(value);
		remaining--;

		if (explode && value === sides && explosions < MAX_EXPLOSIONS) {
			explosions++;
			remaining++;
		}
	}

	return faces;
}

function keptIndexes(faces: number[], keep: DiceTerm['keep']): Set<number> {
	const all = faces.map((_, index) => index);

	if (!keep) return new Set(all);

	const ascending = [...all].sort((a, b) => faces[a]! - faces[b]!);
	const { mode, amount } = keep;
	const chosen =
		mode === 'kh'
			? ascending.slice(-amount)
			: mode === 'kl'
				? ascending.slice(0, amount)
				: mode === 'dh'
					? ascending.slice(0, faces.length - amount)
					: ascending.slice(amount);

	return new Set(chosen);
}

function rollTerm(term: Term, face: RollFace): RolledTerm {
	if (term.kind === 'constant') return { term, dice: [], subtotal: term.value };

	const faces = rollFaces(term, face);
	const kept = keptIndexes(faces, term.keep);
	const dice = faces.map((value, index) => ({ face: value, kept: kept.has(index) }));

	return {
		term,
		dice,
		subtotal: dice.reduce((sum, die) => (die.kept ? sum + die.face : sum), 0),
	};
}

/**
 * @description Rolls parsed dice.
 * @param terms The expression's terms.
 * @param face Rolls one die with the given number of sides, from 1 up to it.
 * @returns Each term's dice and subtotal, and the total.
 */
export function rollDice(terms: Term[], face: RollFace): Roll {
	const rolled = terms.map((term) => rollTerm(term, face));

	return {
		terms: rolled,
		total: rolled.reduce((sum, { term, subtotal }) => sum + term.sign * subtotal, 0),
	};
}

function termText({ term, dice }: RolledTerm): string {
	if (term.kind === 'constant') return String(term.value);

	return `[${dice.map((die) => (die.kept ? String(die.face) : `~~${die.face}~~`)).join(', ')}]`;
}

/**
 * @description Writes a roll as one chat line: the expression, every die with dropped ones struck through, and the
 * total in bold.
 * @param expression The expression as the user wrote it.
 * @param roll The roll.
 * @returns The line.
 */
export function formatRoll(expression: string, { terms, total }: Roll): string {
	const parts = terms.map((rolled, index) => {
		const text = termText(rolled);

		if (index === 0) return rolled.term.sign < 0 ? `-${text}` : text;

		return `${rolled.term.sign < 0 ? '-' : '+'} ${text}`;
	});

	return `🎲 \`${expression.trim()}\`: ${parts.join(' ')} = **${total}**`;
}

/**
 * @description Rolls one die fairly.
 * @param sides The die's number of sides.
 * @returns A face from 1 up to `sides`.
 */
export function randomFace(sides: number): number {
	return Math.floor(Math.random() * sides) + 1;
}

export default { parseDice, rollDice, formatRoll, randomFace };
