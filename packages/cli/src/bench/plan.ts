import { z } from 'zod';

/** `warm` keeps Unbound's module cache; `cold` empties it before the launch. */
export type LaunchKind = 'warm' | 'cold';

const variantSchema = z.object({
	name: z
		.string()
		.regex(
			/^[A-Za-z0-9][\w.-]{0,31}$/,
			'a variant name is up to 32 letters, digits, ".", "_" or "-"',
		),
	ref: z.string().min(1),
	/** Extra environment for the client and plugin builds, such as a feature switch. */
	env: z.record(z.string(), z.string()).default({}),
});

const protocolSchema = z.object({
	rounds: z.number().int().positive().default(3),
	warm: z.number().int().nonnegative().default(2),
	cold: z.number().int().nonnegative().default(1),
	idleMs: z.number().int().positive().default(25_000),
});

/** The JSON a `--variants` file holds: two or more variants plus optional protocol overrides. */
export const variantsFileSchema = protocolSchema.partial().extend({
	variants: z.array(variantSchema).min(1),
});

export type Variant = z.infer<typeof variantSchema>;

export type Protocol = z.infer<typeof protocolSchema>;

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

	return { ...protocolSchema.parse(protocol), variants };
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
	const parsed = variantsFileSchema.safeParse(json);

	if (!parsed.success) {
		return { error: `The variants file is invalid:\n${z.prettifyError(parsed.error)}` };
	}

	const { variants, ...protocol } = parsed.data;
	const names = new Set(variants.map((variant) => variant.name));

	if (names.size !== variants.length) {
		return { error: 'The variants file names a variant twice.' };
	}

	return { ...protocolSchema.parse({ ...protocol, ...overrides }), variants };
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
