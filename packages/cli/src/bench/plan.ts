import { defaulted, parse, safeParse, Type, type StaticDecode } from '~/lib/schema';

/** `warm` keeps Unbound's module cache; `cold` empties it before the launch. */
export type LaunchKind = 'warm' | 'cold';

/**
 * `none` measures core alone: no plugin, theme, icon pack or font is installed or applied, and plugins are not built.
 * `all` installs and enables every first-party plugin the variant builds.
 */
export type AddonMode = 'none' | 'all';

const variantSchema = Type.Object({
	name: Type.String({
		pattern: '^[A-Za-z0-9][\\w.-]{0,31}$',
		errorMessage: 'a variant name is up to 32 letters, digits, ".", "_" or "-"',
	}),
	ref: Type.String({ minLength: 1 }),
	/** Extra environment for the client and plugin builds, such as a feature switch. */
	env: defaulted(Type.Record(Type.String(), Type.String()), {}),
});

const protocolSchema = Type.Object({
	rounds: defaulted(Type.Integer({ minimum: 1 }), 3),
	warm: defaulted(Type.Integer({ minimum: 0 }), 2),
	cold: defaulted(Type.Integer({ minimum: 0 }), 1),
	idleMs: defaulted(Type.Integer({ minimum: 1 }), 25_000),
	addons: defaulted(Type.Enum(['none', 'all']), 'none'),
});

/** The JSON a `--variants` file holds: two or more variants plus optional protocol overrides. */
export const variantsFileSchema = Type.Object({
	rounds: Type.Optional(Type.Integer({ minimum: 1 })),
	warm: Type.Optional(Type.Integer({ minimum: 0 })),
	cold: Type.Optional(Type.Integer({ minimum: 0 })),
	idleMs: Type.Optional(Type.Integer({ minimum: 1 })),
	addons: Type.Optional(Type.Enum(['none', 'all'])),
	variants: Type.Array(variantSchema, { minItems: 1 }),
});

export type Variant = StaticDecode<typeof variantSchema>;

export type Protocol = StaticDecode<typeof protocolSchema>;

export type Plan = Protocol & { variants: Variant[] };

/** One stretch of launches on one variant: a switch, its warm-ups, then the measured launches. */
export type Block = { round: number; variant: Variant; warm: number; cold: number };

/**
 * @description Builds a plan from refs given on the command line, naming the variants A, B, C and so on.
 * @param refs The git refs to compare, the baseline first.
 * @param protocol Overrides for the launch counts and the idle sample time.
 * @returns The plan.
 */
export function planFromRefs(refs: string[], protocol: Partial<Protocol> = {}): Plan {
	const variants = refs.map((ref, index) => ({
		name: String.fromCodePoint(65 + index),
		ref,
		env: {},
	}));

	return { ...parse(protocolSchema, protocol), variants };
}

/**
 * @description Reads a variants file's JSON, letting command-line overrides win over the file's protocol.
 * @param json The parsed file.
 * @param overrides Protocol values given on the command line.
 * @returns The plan, or why the file is unusable.
 */
export function planFromFile(
	// UNKNOWN: a parsed JSON file, validated here.
	json: unknown,
	overrides: Partial<Protocol> = {},
): Plan | { error: string } {
	const parsed = safeParse(variantsFileSchema, json);

	if (!parsed.success) {
		return { error: `The variants file is invalid:\n${parsed.error.message}` };
	}

	const { variants, ...protocol } = parsed.data;
	const names = new Set(variants.map((variant) => variant.name));

	if (names.size !== variants.length) {
		return { error: 'The variants file names a variant twice.' };
	}

	return { ...parse(protocolSchema, { ...protocol, ...overrides }), variants };
}

/**
 * @description Orders the launches: every round visits each variant once, and odd rounds reverse the order so
 * drift and the previous variant's leftovers favour no side.
 * @param plan The plan.
 * @returns The blocks in run order.
 */
export function schedule(plan: Plan): Block[] {
	const blocks: Block[] = [];

	for (let round = 0; round < plan.rounds; round++) {
		const order = round % 2 === 0 ? plan.variants : plan.variants.toReversed();

		for (const variant of order) {
			blocks.push({ round, variant, warm: plan.warm, cold: plan.cold });
		}
	}

	return blocks;
}

export default { variantsFileSchema, planFromRefs, planFromFile, schedule };
