type Token =
	| { kind: 'number'; value: number }
	| { kind: 'name'; value: string }
	| { kind: 'operator'; value: string };

type Parser = { tokens: Token[]; index: number };

const SIGNIFICANT_DIGITS = 12;

const OPERATOR_ALIASES: Record<string, string> = {
	'×': '*',
	'·': '*',
	'÷': '/',
	'−': '-',
	'**': '^',
};

const CONSTANTS: Record<string, number> = { pi: Math.PI, π: Math.PI, e: Math.E, tau: Math.PI * 2 };

const FUNCTIONS: Record<string, (...args: number[]) => number> = {
	sqrt: Math.sqrt,
	cbrt: Math.cbrt,
	abs: Math.abs,
	round: Math.round,
	floor: Math.floor,
	ceil: Math.ceil,
	sin: Math.sin,
	cos: Math.cos,
	tan: Math.tan,
	asin: Math.asin,
	acos: Math.acos,
	atan: Math.atan,
	ln: Math.log,
	log: Math.log10,
	log2: Math.log2,
	exp: Math.exp,
	min: Math.min,
	max: Math.max,
};

const NUMBER = /^\d+(?:[.,]\d+)?|^\.\d+/;
const NAME = /^[a-zπ][a-z0-9]*/i;
const OPERATOR = /^(?:\*\*|[-+*/^%(),×·÷−])/;

class CalculationError extends Error {}

function startsOperand(text: string): boolean {
	return /^\s*(?:[\d.(]|[a-zπ])/i.test(text);
}

function tokenize(source: string): Token[] {
	const tokens: Token[] = [];
	const calls: boolean[] = [];
	let rest = source;

	while ((rest = rest.trimStart())) {
		const number = NUMBER.exec(rest)?.[0];

		if (number) {
			const separatesArguments = calls.at(-1) && number.includes(',');
			const text = separatesArguments ? number.split(',')[0]! : number;

			tokens.push({ kind: 'number', value: Number(text.replace(',', '.')) });
			rest = rest.slice(text.length);
			continue;
		}

		const name = NAME.exec(rest)?.[0];

		if (name) {
			tokens.push({ kind: 'name', value: name.toLowerCase() });
			rest = rest.slice(name.length);
			continue;
		}

		const operator = OPERATOR.exec(rest)?.[0];

		if (!operator) throw new CalculationError(rest);

		const value = OPERATOR_ALIASES[operator] ?? operator;
		const previous = tokens.at(-1);

		if (value === '(') calls.push(previous?.kind === 'name');
		if (value === ')') calls.pop();

		rest = rest.slice(operator.length);
		tokens.push({
			kind: 'operator',
			value: value === '%' && !startsOperand(rest) ? 'percent' : value,
		});
	}

	return tokens;
}

function peek(parser: Parser): Token | undefined {
	return parser.tokens[parser.index];
}

function take(parser: Parser, value?: string): Token {
	const token = parser.tokens[parser.index];

	if (!token || (value !== undefined && token.value !== value)) throw new CalculationError(value);

	parser.index++;

	return token;
}

function isOperator(token: Token | undefined, ...values: string[]): boolean {
	return token?.kind === 'operator' && values.includes(token.value);
}

function callArguments(parser: Parser): number[] {
	const args = [expression(parser)];

	while (isOperator(peek(parser), ',')) {
		take(parser, ',');
		args.push(expression(parser));
	}

	take(parser, ')');

	return args;
}

function primary(parser: Parser): number {
	const token = take(parser);

	if (token.kind === 'number') return token.value;

	if (token.kind === 'name') {
		const fn = FUNCTIONS[token.value];

		if (fn && isOperator(peek(parser), '(')) {
			take(parser, '(');

			return fn(...callArguments(parser));
		}

		const constant = CONSTANTS[token.value];

		if (constant === undefined) throw new CalculationError(token.value);

		return constant;
	}

	if (token.value !== '(') throw new CalculationError(token.value);

	const value = expression(parser);

	take(parser, ')');

	return value;
}

function postfix(parser: Parser): number {
	let value = primary(parser);

	while (isOperator(peek(parser), 'percent')) {
		take(parser);
		value /= 100;
	}

	return value;
}

function power(parser: Parser): number {
	const base = postfix(parser);

	if (!isOperator(peek(parser), '^')) return base;

	take(parser, '^');

	return base ** unary(parser);
}

function unary(parser: Parser): number {
	if (isOperator(peek(parser), '-', '+')) {
		const sign = take(parser).value === '-' ? -1 : 1;

		return sign * unary(parser);
	}

	return power(parser);
}

function product(parser: Parser): number {
	let value = unary(parser);

	while (isOperator(peek(parser), '*', '/', '%')) {
		const operator = take(parser).value;
		const right = unary(parser);

		if ((operator === '/' || operator === '%') && right === 0) throw new CalculationError('0');

		value = operator === '*' ? value * right : operator === '/' ? value / right : value % right;
	}

	return value;
}

function expression(parser: Parser): number {
	let value = product(parser);

	while (isOperator(peek(parser), '+', '-')) {
		const operator = take(parser).value;
		const right = product(parser);

		value = operator === '+' ? value + right : value - right;
	}

	return value;
}

function withoutEquals(text: string): string {
	return text.trim().replace(/\s*=\s*$/, '');
}

/**
 * @description Calculates an arithmetic expression: `+ - * / % ^`, `×` and `÷`, parentheses, percentages, decimals with
 * a dot or comma, and functions and constants such as `sqrt`, `round`, `max`, `pi` and `e`.
 * @param text The expression.
 * @returns The result, or `undefined` when the text is not an expression or has no finite result.
 */
export function evaluate(text: string): number | undefined {
	try {
		const parser = { tokens: tokenize(text), index: 0 };
		const value = expression(parser);

		return parser.index === parser.tokens.length && Number.isFinite(value) ? value : undefined;
	} catch (error) {
		if (error instanceof CalculationError) return undefined;

		throw error;
	}
}

/**
 * @description Whether a draft is a calculation worth offering: an expression with an operator or a function, not a
 * lone number, optionally ending in `=`.
 * @param draft The chat input's text.
 * @returns `true` when the calculator can work it out.
 */
export function isCalculation(draft: string): boolean {
	const text = withoutEquals(draft);
	const hasWork = /[*/^%×÷(]|\d\s*[-+−]\s*[\d.(a-z]/i.test(text);

	return hasWork && evaluate(text) !== undefined;
}

/**
 * @description Writes a result without floating point noise, to 12 significant digits.
 * @param value The result.
 * @returns The number as text.
 */
export function formatNumber(value: number): string {
	return String(Number(value.toPrecision(SIGNIFICANT_DIGITS)));
}

/**
 * @description Works out a draft as the calculator inserts it: the result alone, or the expression followed by it.
 * @param draft The chat input's text, optionally ending in `=`.
 * @returns Both forms, or `undefined` when the draft is not a calculation.
 */
export function calculation(draft: string): { result: string; full: string } | undefined {
	const text = withoutEquals(draft);
	const value = evaluate(text);

	if (value === undefined) return undefined;

	const result = formatNumber(value);

	return { result, full: `${text} = ${result}` };
}

export default { evaluate, isCalculation, formatNumber, calculation };
