type Version = [number, number, number];

export type DependentAddon = {
	id: string;
	data: {
		name: string;
		version: string;
		library?: boolean;
		dependencies?: Record<string, string>;
	};
};

export type ListedDependency = {
	id: string;
	name: string;
	version: string;
	dependencies?: Record<string, string>;
};

export type DependencyPlan = {
	/** Missing dependencies to install, each after the ones it needs itself. */
	install: ListedDependency[];
	/** Installed dependencies whose version is outside the range, with the newer listed version. */
	update: ListedDependency[];
	/** Dependencies the store cannot satisfy, as `id range`. */
	unavailable: string[];
	/** Every install and update together, each after what it needs. */
	ordered: ListedDependency[];
};

const VERSION = /^v?(\d+)\.(\d+)\.(\d+)(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/;

function parse(version: string): Version | undefined {
	const match = VERSION.exec(version.trim());

	return match ? [Number(match[1]), Number(match[2]), Number(match[3])] : undefined;
}

function compare(left: Version, right: Version): number {
	return left[0] - right[0] || left[1] - right[1] || left[2] - right[2];
}

function satisfiesComparator(version: Version, comparator: string): boolean {
	if (comparator === '*' || comparator === '' || comparator === 'x') {
		return true;
	}

	const prefix = /^(\^|~|>=|<=|>|<|=)?/.exec(comparator)?.[1] ?? '';
	const operator = prefix || '=';
	const bound = parse(comparator.slice(prefix.length));

	if (!bound) {
		return false;
	}

	const order = compare(version, bound);

	switch (operator) {
		case '^':
			if (order < 0) {
				return false;
			}

			if (bound[0] > 0) {
				return version[0] === bound[0];
			}

			if (bound[1] > 0) {
				return version[0] === 0 && version[1] === bound[1];
			}

			return version[0] === 0 && version[1] === 0 && version[2] === bound[2];
		case '~':
			return order >= 0 && version[0] === bound[0] && version[1] === bound[1];
		case '>=':
			return order >= 0;
		case '<=':
			return order <= 0;
		case '>':
			return order > 0;
		case '<':
			return order < 0;
		default:
			return order === 0;
	}
}

/**
 * @description Checks a version against a semver range: `^`, `~`, comparisons, exact versions, `*`,
 * space-separated intersections and `||` alternatives.
 * @param version The installed or listed version.
 * @param range The range a manifest declares.
 * @returns Whether the version is in the range; a version or range that does not parse is not.
 */
export function satisfies(version: string, range: string): boolean {
	const parsed = parse(version);

	if (!parsed) {
		return false;
	}

	return range.split('||').some((alternative) =>
		alternative
			.trim()
			.split(/\s+/)
			.every((comparator) => satisfiesComparator(parsed, comparator)),
	);
}

/**
 * @description Whether an addon is a library: it says so, or another installed addon depends on it.
 * @param addon The addon.
 * @param installed Every installed addon.
 * @returns Whether to treat it as a library.
 */
export function isLibrary(addon: DependentAddon, installed: readonly DependentAddon[]): boolean {
	return (
		addon.data.library === true ||
		installed.some((other) => other.id !== addon.id && other.data.dependencies?.[addon.id])
	);
}

/**
 * @description Lists every installed addon that needs this one, directly or through others, in the
 * order to remove them: each before anything it depends on.
 * @param id The addon about to be removed.
 * @param installed Every installed addon.
 * @returns The dependents, removal order first.
 */
export function dependentsOf(id: string, installed: readonly DependentAddon[]): DependentAddon[] {
	const ordered: DependentAddon[] = [];
	const seen = new Set<string>([id]);

	function visit(target: string) {
		for (const addon of installed) {
			if (seen.has(addon.id) || !addon.data.dependencies?.[target]) {
				continue;
			}

			seen.add(addon.id);
			visit(addon.id);
			ordered.push(addon);
		}
	}

	visit(id);

	return ordered;
}

/**
 * @description Works out what installing an addon needs from the store, following each dependency's
 * own dependencies, so everything is installed before what needs it.
 * @param dependencies The manifest's `dependencies`.
 * @param installed The installed version of each addon, by id.
 * @param listed The store's newest version of each addon, by id.
 * @returns What to install, what to update and what cannot be satisfied.
 */
export function planDependencies(
	dependencies: Record<string, string> | undefined,
	installed: ReadonlyMap<string, string>,
	listed: ReadonlyMap<string, ListedDependency>,
): DependencyPlan {
	const plan: DependencyPlan = { install: [], update: [], unavailable: [], ordered: [] };
	const visited = new Set<string>();

	function resolve(wanted: Record<string, string> | undefined) {
		for (const [id, range] of Object.entries(wanted ?? {})) {
			if (visited.has(id)) {
				continue;
			}

			visited.add(id);

			const current = installed.get(id);

			if (current && satisfies(current, range)) {
				continue;
			}

			const candidate = listed.get(id);

			if (!candidate || !satisfies(candidate.version, range)) {
				plan.unavailable.push(`${id} ${range}`);
				continue;
			}

			resolve(candidate.dependencies);
			(current ? plan.update : plan.install).push(candidate);
			plan.ordered.push(candidate);
		}
	}

	resolve(dependencies);

	return plan;
}
