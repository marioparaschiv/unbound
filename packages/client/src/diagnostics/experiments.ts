import { findStore } from '~/metro/lookups';

const MAX_LISTED_EXPERIMENTS = 30;
const CONTROL = 0;

type ApexAssignment = { variantId?: number; isOverride?: boolean };

type ApexEvaluation = { assignments?: Record<string, ApexAssignment> };

type ApexState = {
	evaluatedExperiments?: {
		user?: Record<string, ApexEvaluation>;
	};
};

type LegacyOverride = { bucket?: number };

type ApexDefinition = { kind?: string };

/** What the two experiment systems report, reduced to what the debug report needs. */
export type ExperimentSources = {
	apexDefinitions: Record<string, ApexDefinition>;
	apexAssignments: Record<string, ApexAssignment>;
	hashOf: (name: string) => number | string;
	legacyAssignments: Record<string, number>;
	legacyOverrides: Record<string, LegacyOverride>;
};

const ApexStore = findStore('ApexExperiment');
const ExperimentStore = findStore('Experiment');

/**
 * @description Lists the experiments where this user is off Discord's default, as `name=variant`, an override marked `*`.
 * @param sources The experiment systems' state.
 * @returns The entries, sorted, at most {@link MAX_LISTED_EXPERIMENTS}.
 */
export function offDefaultExperiments(sources: ExperimentSources): string[] {
	const apex = Object.entries(sources.apexDefinitions)
		.filter(([, definition]) => definition.kind === 'user')
		.flatMap(([name]) => {
			const assignment = sources.apexAssignments[String(sources.hashOf(name))];
			const variant = assignment?.variantId;

			if (variant === undefined || (variant === CONTROL && !assignment?.isOverride)) {
				return [];
			}

			return [`${name}=${variant}${assignment?.isOverride ? '*' : ''}`];
		});
	const legacy = Object.entries(sources.legacyAssignments)
		.filter(([name, bucket]) => bucket > CONTROL || name in sources.legacyOverrides)
		.map(([name, bucket]) => `${name}=${bucket}${name in sources.legacyOverrides ? '*' : ''}`);

	return [...apex, ...legacy].sort().slice(0, MAX_LISTED_EXPERIMENTS);
}

function apexAssignments(): Record<string, ApexAssignment> {
	const state = ApexStore.getState?.() as ApexState | undefined;
	const [user] = Object.values(state?.evaluatedExperiments?.user ?? {});

	return user?.assignments ?? {};
}

/**
 * @description Reads which Discord experiments this user is off the default in, from both of Discord's experiment systems.
 * @returns The entries, or `undefined` when there are none.
 */
export function readExperiments(): string[] | undefined {
	const listed = offDefaultExperiments({
		apexDefinitions: ApexStore.getRegisteredExperiments?.() ?? {},
		apexAssignments: apexAssignments(),
		hashOf: (name) => ApexStore.getHash(name),
		legacyAssignments: ExperimentStore.getAllExperimentAssignments?.() ?? {},
		legacyOverrides: ExperimentStore.getAllExperimentOverrideDescriptors?.() ?? {},
	});

	return listed.length ? listed : undefined;
}
