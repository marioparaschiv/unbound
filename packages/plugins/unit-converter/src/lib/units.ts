export type TargetSystem = 'metric' | 'imperial' | 'both';

type System = 'metric' | 'imperial';

type Quantity = 'length' | 'mass' | 'volume' | 'speed' | 'temperature';

type Unit = {
	quantity: Quantity;
	system: System;
	toBase: (value: number) => number;
	attachedOnly?: boolean;
	spacedOnly?: boolean;
	caseSensitive?: boolean;
};

const scale = (factor: number) => (value: number) => value * factor;

const UNITS: Record<string, Unit> = {
	mm: { quantity: 'length', system: 'metric', toBase: scale(0.001) },
	cm: { quantity: 'length', system: 'metric', toBase: scale(0.01) },
	m: { quantity: 'length', system: 'metric', toBase: scale(1), spacedOnly: true },
	km: { quantity: 'length', system: 'metric', toBase: scale(1000) },
	in: { quantity: 'length', system: 'imperial', toBase: scale(0.0254), attachedOnly: true },
	ft: { quantity: 'length', system: 'imperial', toBase: scale(0.3048) },
	yd: { quantity: 'length', system: 'imperial', toBase: scale(0.9144) },
	mi: { quantity: 'length', system: 'imperial', toBase: scale(1609.344) },
	g: { quantity: 'mass', system: 'metric', toBase: scale(0.001), caseSensitive: true },
	kg: { quantity: 'mass', system: 'metric', toBase: scale(1) },
	oz: { quantity: 'mass', system: 'imperial', toBase: scale(0.028349523125) },
	lb: { quantity: 'mass', system: 'imperial', toBase: scale(0.45359237) },
	ml: { quantity: 'volume', system: 'metric', toBase: scale(0.001) },
	l: { quantity: 'volume', system: 'metric', toBase: scale(1), attachedOnly: true },
	floz: { quantity: 'volume', system: 'imperial', toBase: scale(0.0295735295625) },
	gal: { quantity: 'volume', system: 'imperial', toBase: scale(3.785411784) },
	kmh: { quantity: 'speed', system: 'metric', toBase: scale(1) },
	mph: { quantity: 'speed', system: 'imperial', toBase: scale(1.609344) },
	c: { quantity: 'temperature', system: 'metric', toBase: (value) => value },
	f: { quantity: 'temperature', system: 'imperial', toBase: (value) => ((value - 32) * 5) / 9 },
};

const ALIASES: [string, string][] = [
	['millimetres?|millimeters?|mm', 'mm'],
	['centimetres?|centimeters?|cm', 'cm'],
	['kilometres?|kilometers?|km', 'km'],
	['metres?|meters?|m', 'm'],
	['inch(?:es)?|in', 'in'],
	['feet|foot|ft', 'ft'],
	['yards?|yds?', 'yd'],
	['miles?|mi', 'mi'],
	['kilograms?|kilos?|kgs?', 'kg'],
	['grams?|g', 'g'],
	['ounces?|oz', 'oz'],
	['pounds?|lbs?', 'lb'],
	['millilit(?:re|er)s?|ml', 'ml'],
	['lit(?:re|er)s?|l', 'l'],
	['fl\\.? ?oz|fluid ounces?', 'floz'],
	['gallons?|gal', 'gal'],
	['km/h|kmh|kph', 'kmh'],
	['mph', 'mph'],
	['°c|℃|degrees? c(?:elsius)?|celsius', 'c'],
	['°f|℉|degrees? f(?:ahrenheit)?|fahrenheit', 'f'],
];

const NBSP = '\u00a0';
const NUMBER = String.raw`-?\d+(?:[.,]\d+)?`;
const END = String.raw`(?![\p{L}\p{N}_/])`;
const UNIT_PATTERN = ALIASES.map(([pattern]) => pattern)
	.sort((a, b) => b.length - a.length)
	.join('|');
const MEASUREMENT = new RegExp(
	[
		String.raw`(?<markFeet>\d+)' ?(?<markInches>\d+(?:\.\d+)?)(?:"|'')`,
		String.raw`(?<wordFeet>\d+) ?(?:feet|foot|ft) ?(?<wordInches>\d+(?:\.\d+)?) ?(?:inch(?:es)?|in)${END}`,
		String.raw`(?<![\p{L}\p{N}_.])(?<value>${NUMBER})(?<space> ?)(?<unit>${UNIT_PATTERN})${END}`,
	].join('|'),
	'giu',
);
const PROTECTED = /(```[\s\S]*?```|`[^`\n]*`|https?:\/\/\S+|<[^>\n]+>)/g;

function unitKey(raw: string): string | undefined {
	const lower = raw.toLowerCase();

	for (const [pattern, key] of ALIASES) {
		if (new RegExp(`^(?:${pattern})$`, 'i').test(lower)) return key;
	}

	return undefined;
}

function parseNumber(raw: string): number {
	const thousands = /,\d{3}$/.test(raw);

	return Number.parseFloat(thousands ? raw.replace(',', '') : raw.replace(',', '.'));
}

function round(value: number): string {
	const magnitude = Math.abs(value);
	const decimals = magnitude >= 100 ? 0 : magnitude >= 10 ? 1 : 2;
	const fixed = value.toFixed(decimals);
	const trimmed = fixed.includes('.') ? fixed.replace(/\.?0+$/, '') : fixed;

	return trimmed === '-0' ? '0' : trimmed;
}

function metricText(quantity: Quantity, base: number): string {
	const size = Math.abs(base);

	switch (quantity) {
		case 'length':
			if (size < 0.01) return `${round(base * 1000)}${NBSP}mm`;
			if (size < 1) return `${round(base * 100)}${NBSP}cm`;
			if (size < 1000) return `${round(base)}${NBSP}m`;

			return `${round(base / 1000)}${NBSP}km`;
		case 'mass':
			return size < 1 ? `${round(base * 1000)}${NBSP}g` : `${round(base)}${NBSP}kg`;
		case 'volume':
			return size < 1 ? `${round(base * 1000)}${NBSP}ml` : `${round(base)}${NBSP}L`;
		case 'speed':
			return `${round(base)}${NBSP}km/h`;
		case 'temperature':
			return `${round(base)}${NBSP}°C`;
	}
}

function feetAndInches(inches: number): string {
	let feet = Math.floor(inches / 12);
	let rest = Math.round(inches - feet * 12);

	if (rest === 12) {
		feet += 1;
		rest = 0;
	}

	return `${feet}'${rest}"`;
}

function imperialText(quantity: Quantity, base: number): string {
	const size = Math.abs(base);

	switch (quantity) {
		case 'length': {
			const inches = base / 0.0254;

			if (size < 0.3048) return `${round(inches)}${NBSP}in`;
			if (size < 3.048) return feetAndInches(inches);
			if (size < 160.9344) return `${round(base / 0.3048)}${NBSP}ft`;

			return `${round(base / 1609.344)}${NBSP}mi`;
		}
		case 'mass': {
			const pounds = base / 0.45359237;

			return Math.abs(pounds) < 1
				? `${round(pounds * 16)}${NBSP}oz`
				: `${round(pounds)}${NBSP}lb`;
		}
		case 'volume': {
			const ounces = base / 0.0295735295625;

			return Math.abs(ounces) < 128
				? `${round(ounces)}${NBSP}fl${NBSP}oz`
				: `${round(ounces / 128)}${NBSP}gal`;
		}
		case 'speed':
			return `${round(base / 1.609344)}${NBSP}mph`;
		case 'temperature':
			return `${round((base * 9) / 5 + 32)}${NBSP}°F`;
	}
}

function wanted(system: System, target: TargetSystem): boolean {
	return target === 'both' || system !== target;
}

function converted(system: System, quantity: Quantity, base: number): string {
	return system === 'imperial' ? metricText(quantity, base) : imperialText(quantity, base);
}

function convertMeasurement(groups: Record<string, string | undefined>, target: TargetSystem) {
	const feet = groups.markFeet ?? groups.wordFeet;
	const inches = groups.markInches ?? groups.wordInches;

	if (feet !== undefined && inches !== undefined) {
		if (!wanted('imperial', target)) return undefined;

		return metricText('length', (Number(feet) * 12 + Number(inches)) * 0.0254);
	}

	const { unit: raw, value, space } = groups;
	const key = raw ? unitKey(raw) : undefined;
	const unit = key ? UNITS[key] : undefined;

	if (!raw || !unit || !value || !wanted(unit.system, target)) return undefined;
	if (unit.attachedOnly && space && raw === key) return undefined;
	if (unit.spacedOnly && !space && raw === key) return undefined;
	if (unit.caseSensitive && raw !== raw.toLowerCase()) return undefined;

	return converted(unit.system, unit.quantity, unit.toBase(parseNumber(value)));
}

function convertPlain(text: string, target: TargetSystem): string {
	return text.replace(MEASUREMENT, (match, ...rest) => {
		const groups = rest.at(-1) as Record<string, string | undefined>;
		const conversion = convertMeasurement(groups, target);

		return conversion ? `${match} (≈${NBSP}${conversion})` : match;
	});
}

/**
 * @description Adds a conversion in brackets after each measurement in a message, leaving code, links and mentions alone.
 * @param text The message text.
 * @param target Which system to convert into: `metric`, `imperial`, or `both` to convert each into the other.
 * @returns The text with conversions, or the same string when nothing converts.
 */
export function convertText(text: string, target: TargetSystem): string {
	const parts = text.split(PROTECTED);
	let changed = false;
	const result = parts
		.map((part, index) => {
			if (index % 2 === 1) return part;

			const next = convertPlain(part, target);

			changed ||= next !== part;

			return next;
		})
		.join('');

	return changed ? result : text;
}
