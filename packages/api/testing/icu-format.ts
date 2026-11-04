import {
	parseIcu,
	type IcuArgumentNode,
	type IcuNode,
	type IcuPluralNode,
	type IcuSelectNode,
} from './icu-parse';

/** A value `format` puts into a placeholder, as the client's `FormatVars` types it. */
export type IcuValue = string | number | boolean | Date;

/** The values of a message's placeholders, by name. */
export type IcuVars = Record<string, IcuValue>;

const DATE_STYLES = new Set(['short', 'medium', 'long', 'full']);

function numberOptions(style: string): Intl.NumberFormatOptions {
	if (style === 'integer') {
		return { maximumFractionDigits: 0 };
	}

	if (style === 'percent') {
		return { style: 'percent' };
	}

	return {};
}

function dateOptions(type: string, style: string): Intl.DateTimeFormatOptions {
	const picked = DATE_STYLES.has(style) ? style : 'medium';
	const value = picked as NonNullable<Intl.DateTimeFormatOptions['dateStyle']>;

	return type === 'time' ? { timeStyle: value } : { dateStyle: value };
}

function valueOf(vars: IcuVars, name: string): IcuValue {
	const value = vars[name];

	if (value === undefined) {
		throw new Error(`Failed to format a message: no value for {${name}}.`);
	}

	return value;
}

function formatArgument(node: IcuArgumentNode, vars: IcuVars, locale: string) {
	const value = valueOf(vars, node.name);

	if (node.type === 'number') {
		return new Intl.NumberFormat(locale, numberOptions(node.style)).format(Number(value));
	}

	if (node.type === 'date' || node.type === 'time') {
		const date = value instanceof Date ? value : new Date(Number(value));

		return new Intl.DateTimeFormat(locale, dateOptions(node.type, node.style)).format(date);
	}

	return value instanceof Date ? value.toISOString() : String(value);
}

// A plural or select without `other` has nothing to fall back to, so formatting it throws.
function otherBranch(node: IcuPluralNode | IcuSelectNode): IcuNode[] {
	const other = node.branches.get('other');

	if (!other) {
		throw new Error(`Failed to format a message: {${node.name}} has no "other" branch.`);
	}

	return other;
}

function pickPlural(node: IcuPluralNode, value: number, locale: string) {
	const exact = node.branches.get(`=${value}`);

	if (exact) {
		return exact;
	}

	const rules = new Intl.PluralRules(locale, { type: node.ordinal ? 'ordinal' : 'cardinal' });

	return node.branches.get(rules.select(value - node.offset)) ?? otherBranch(node);
}

function formatNodes(nodes: IcuNode[], vars: IcuVars, locale: string, pound?: number): string {
	let output = '';

	for (const node of nodes) {
		switch (node.kind) {
			case 'text':
				output += node.text;
				break;
			case 'pound':
				output += pound === undefined ? '#' : new Intl.NumberFormat(locale).format(pound);
				break;
			case 'argument':
				output += formatArgument(node, vars, locale);
				break;
			case 'plural': {
				const value = Number(valueOf(vars, node.name));

				output += formatNodes(
					pickPlural(node, value, locale),
					vars,
					locale,
					value - node.offset,
				);
				break;
			}
			case 'select': {
				const value = String(valueOf(vars, node.name));
				const branch = node.branches.get(value) ?? otherBranch(node);

				output += formatNodes(branch, vars, locale, pound);
				break;
			}
		}
	}

	return output;
}

/**
 * @description Formats an ICU MessageFormat string in a locale, as Discord's `MessageFormat` does on device.
 * @param message The message.
 * @param vars The values of its placeholders; a placeholder without one throws.
 * @param locale The locale plural rules, numbers and dates follow, such as `de`.
 * @returns The formatted message.
 */
export function formatIcu(message: string, vars: IcuVars = {}, locale: string = 'en-US'): string {
	return formatNodes(parseIcu(message), vars, locale);
}
