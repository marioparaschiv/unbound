import type {
	ComponentRecord,
	LiteralValue,
	PropEvidence,
	PropObservation,
	TargetRef,
} from './types';

import { compare } from './naming';

export type RuleName =
	| 'forwarded'
	| 'host'
	| 'literal-union'
	| 'default'
	| 'compared'
	| 'called'
	| 'name'
	| 'passed'
	| 'members'
	| 'unknown';

/** A referenced generated component or React Native host, so the emitter can import it. */
export type TypeRef = { kind: 'component'; component: ComponentRecord } | { kind: 'host' };

export type InferredType = {
	text: string;
	rule: RuleName;
	refs: TypeRef[];
};

export type PropInput = {
	component: ComponentRecord;
	name: string;
	evidence: PropEvidence;
};

/** What a rule may ask about the rest of the build. */
export type InferEnv = {
	/** The type of `key` on a generated component target, as a reference, when that prop is typed. */
	componentProp: (target: TargetRef, key: string) => InferredType | undefined;
	/** The type of `key` on a React Native host target, when the host declares it. */
	hostProp: (target: TargetRef, key: string) => InferredType | undefined;
};

export type Rule = {
	name: RuleName;
	infer: (prop: PropInput, env: InferEnv) => InferredType | undefined;
};

export const FUNCTION_TYPE = '(...args: any[]) => unknown';
export const STYLE_TYPE = 'RN.StyleProp<RN.ViewStyle | RN.TextStyle | RN.ImageStyle>';

const BOOLEAN_PREFIX = /^(is|has|should|show|can|hide|allow|enable|disable|use)[A-Z]/;
const BOOLEAN_NAMES = new Set([
	'disabled',
	'loading',
	'visible',
	'selected',
	'checked',
	'active',
	'expanded',
	'animated',
	'focused',
	'hidden',
	'enabled',
	'editable',
	'inverted',
]);

function isIdName(name: string): boolean {
	return name === 'id' || name === 'testID' || /[a-z]Id$/.test(name);
}

function typed(text: string, rule: RuleName, refs: TypeRef[] = []): InferredType {
	return { text, rule, refs };
}

function literalsOf(evidence: PropEvidence, kinds: ReadonlyArray<PropObservation['kind']>) {
	const values: LiteralValue[] = [];

	for (const observation of evidence) {
		if (!kinds.includes(observation.kind) || !('value' in observation)) {
			continue;
		}

		if (observation.value !== null) {
			values.push(observation.value);
		}
	}

	return values;
}

// Enum members read like `heading-sm/bold`, `secondary` or `flex-start`: one lowercase-led token, no spaces.
const ENUM_TOKEN = /^[a-z]\w*(?:[-/.]\w+)*$/;
// Props that carry data or prose, whose call-site values are examples rather than a closed set.
const FREE_TEXT_NAME =
	/^(?:children|id|key|name|title|subtitle|label|text|description|message|hint|placeholder|url|uri|value|defaultValue|query)$|(?:Id|ID|Key|Name|Title|Label|Text|Description|Message|Hint|Placeholder|Url|URL|Uri)$/;

const DIMENSION_NAME =
	/^(?:width|height|top|left|right|bottom|inset|flexBasis)$|(?:Width|Height|Top|Left|Right|Bottom|Inset|Radius|Margin|Padding|Offset)$|^(?:min|max|margin|padding)[A-Z]/;

/**
 * @description Types a prop from the literals call sites pass when nothing better applies. Layout dimensions take
 * numbers and strings (`12`, `'100%'`), so one caller's choice does not close the other off.
 * @param name The prop's name.
 * @param values The passed literals.
 * @returns The type text, or undefined when the values disagree on their type.
 */
export function passedType(name: string, values: LiteralValue[]): string | undefined {
	const types = new Set(values.map((value) => typeof value));
	const [type] = types;

	if (types.size !== 1 || !type) return;

	return DIMENSION_NAME.test(name) && type !== 'boolean' ? 'number | string' : type;
}

/**
 * @description Tells whether the literals call sites pass for a prop read as members of an enum, not as free text.
 * @param name The prop's name.
 * @param values The passed literals.
 * @returns True when every value is an enum token and the prop's name does not mark it as data or prose.
 */
export function isEnumLike(name: string, values: LiteralValue[]): boolean {
	return (
		!FREE_TEXT_NAME.test(name) &&
		values.every((value) => typeof value === 'string' && ENUM_TOKEN.test(value))
	);
}

// A value whose type is tested may be a function or an object on one path and something else on another.
function isPolymorphic(evidence: PropEvidence): boolean {
	return evidence.some((observation) => observation.kind === 'typeof');
}

function firstForwarded(
	evidence: PropEvidence,
	lookup: (target: TargetRef, key: string) => InferredType | undefined,
	rule: RuleName,
): InferredType | undefined {
	for (const observation of evidence) {
		if (observation.kind !== 'forwarded') {
			continue;
		}

		const found = lookup(observation.target, observation.key);

		if (found) {
			return { ...found, rule };
		}
	}

	return undefined;
}

/**
 * @description Renders a literal as TypeScript type text.
 * @param value The literal.
 * @returns The literal type.
 */
export function literalType(value: LiteralValue): string {
	return typeof value === 'string'
		? `'${value.replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\n/g, '\\n')}'`
		: String(value);
}

/** Prop-name conventions, first match wins. Used only when the code shows nothing better. */
const NAME_TYPES: ReadonlyArray<readonly [(name: string) => boolean, string]> = [
	[(name) => /^on[A-Z]/.test(name), FUNCTION_TYPE],
	[(name) => /^render[A-Z]/.test(name), '(...args: any[]) => React.ReactNode'],
	[(name) => name === 'children', 'React.ReactNode'],
	[(name) => name === 'style' || name.endsWith('Style'), STYLE_TYPE],
	[(name) => BOOLEAN_PREFIX.test(name) || BOOLEAN_NAMES.has(name), 'boolean'],
	[isIdName, 'string'],
	[(name) => name === 'ref', 'React.Ref<any>'],
];

/** Ordered: the first rule that returns a type wins. */
export const RULES: readonly Rule[] = [
	{
		name: 'forwarded',
		infer: ({ evidence }, env) => firstForwarded(evidence, env.componentProp, 'forwarded'),
	},
	{
		name: 'host',
		infer: ({ evidence }, env) => firstForwarded(evidence, env.hostProp, 'host'),
	},
	{
		name: 'literal-union',
		infer: ({ name, evidence }) => {
			const passed = literalsOf(evidence, ['passed']);
			// An empty string is a blank text fallback (`name ?? ''`), not a member of a set of options.
			const values = [
				...literalsOf(evidence, ['default', 'compared']),
				...(isEnumLike(name, passed) ? passed : []),
			].filter((value) => value !== '');

			// An id compared with known ids or sentinels (`skuId === SKU_IDS.X`) is still free text, not an enum.
			if (isIdName(name) || values.length === 0) return;

			const strings = values.filter((value) => typeof value === 'string');

			if (strings.length < values.length) return;

			const members = [...new Set(strings)].sort(compare).map(literalType);

			// `string & {}` keeps the observed values as suggestions without rejecting unseen ones.
			return typed([...members, '(string & {})'].join(' | '), 'literal-union');
		},
	},
	{
		name: 'default',
		infer: ({ evidence }) => {
			const [value] = literalsOf(evidence, ['default']);

			return value === undefined ? undefined : typed(typeof value, 'default');
		},
	},
	{
		name: 'compared',
		infer: ({ name, evidence }) => {
			// `channelId !== EVERYONE_CHANNEL_ID` compares a string id with a numeric sentinel.
			if (isIdName(name)) return;

			const types = new Set(literalsOf(evidence, ['compared']).map((value) => typeof value));

			return types.size === 1 ? typed([...types][0]!, 'compared') : undefined;
		},
	},
	{
		name: 'called',
		infer: ({ evidence }) =>
			evidence.some((observation) => observation.kind === 'called') &&
			!isPolymorphic(evidence)
				? typed(FUNCTION_TYPE, 'called')
				: undefined,
	},
	{
		name: 'name',
		infer: ({ name }) => {
			const text = NAME_TYPES.find(([test]) => test(name))?.[1];

			return text ? typed(text, 'name') : undefined;
		},
	},
	// After `name`: a caller's literal shows one type the prop accepts, not every type.
	{
		name: 'passed',
		infer: ({ name, evidence }) => {
			const text = passedType(name, literalsOf(evidence, ['passed']));

			return text ? typed(text, 'passed') : undefined;
		},
	},
	{
		name: 'members',
		infer: ({ evidence }) => {
			if (isPolymorphic(evidence)) return;

			const names = new Set<string>();

			for (const observation of evidence) {
				if (observation.kind === 'member') {
					names.add(observation.name);
				}
			}

			if (names.size === 0) return;

			const members = [...names].sort().map((name) => `${propertyKey(name)}?: unknown`);

			return typed(`{ ${members.join('; ')} }`, 'members');
		},
	},
	{ name: 'unknown', infer: () => typed('unknown', 'unknown') },
];

/**
 * @description Renders a property name, quoting it when it is not an identifier.
 * @param name The property name.
 * @returns The key as it appears in a type literal.
 */
export function propertyKey(name: string): string {
	return /^[A-Za-z_$][\w$]*$/.test(name) ? name : literalType(name);
}

export default {
	RULES,
	FUNCTION_TYPE,
	STYLE_TYPE,
	isEnumLike,
	passedType,
	literalType,
	propertyKey,
};
