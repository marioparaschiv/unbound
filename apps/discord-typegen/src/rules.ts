import type {
	ComponentRecord,
	LiteralValue,
	PropEvidence,
	PropObservation,
	TargetRef,
} from './types';

export type RuleName =
	| 'forwarded'
	| 'host'
	| 'literal-union'
	| 'default'
	| 'compared'
	| 'called'
	| 'name'
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
	[(name) => name === 'id' || name === 'testID' || /[a-z]Id$/.test(name), 'string'],
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
		infer: ({ evidence }) => {
			const values = literalsOf(evidence, ['default', 'compared']);

			if (values.length === 0 || !values.every((value) => typeof value === 'string')) return;

			const members = [...new Set(values)].sort().map(literalType);

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
		infer: ({ evidence }) => {
			const types = new Set(literalsOf(evidence, ['compared']).map((value) => typeof value));

			return types.size === 1 ? typed([...types][0]!, 'compared') : undefined;
		},
	},
	{
		name: 'called',
		infer: ({ evidence }) =>
			evidence.some((observation) => observation.kind === 'called')
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
	{
		name: 'members',
		infer: ({ evidence }) => {
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

export default { RULES, FUNCTION_TYPE, STYLE_TYPE, literalType, propertyKey };
