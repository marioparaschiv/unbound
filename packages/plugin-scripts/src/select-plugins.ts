/** A first-party plugin as its directory describes it. */
export type LocalPlugin = {
	id: string;
	/** The plugin's directory, relative to `packages/plugins`. */
	dir: string;
	version: string;
	/** The built bundle, relative to `packages/plugins`. */
	bundle: string;
	/** The built bundle's SHA-256, when it has been built. */
	sha256?: string;
	/** The SHA-512 of each bundle compiled to Hermes bytecode, by bytecode version. */
	bytecode?: Record<string, string>;
};

/** The newest version the backend published for an addon, delisted or not, and the commit it was read from. */
export type PublishedVersion = {
	version: string;
	commitSha: string | null;
	/** The published bundle's SHA-256. */
	sha256?: string;
	/** The published `manifest.bytecode`. */
	bytecode?: Record<string, string>;
};

export type PublishedVersions = Map<string, PublishedVersion>;

export type PluginDecision =
	| { status: 'selected'; reason: 'unpublished'; plugin: LocalPlugin }
	| { status: 'selected'; reason: 'newer'; plugin: LocalPlugin; published: PublishedVersion }
	| { status: 'selected'; reason: 'rebuilt'; plugin: LocalPlugin; published: PublishedVersion }
	| {
			status: 'skipped';
			reason: 'already-published' | 'behind-published';
			plugin: LocalPlugin;
			published: PublishedVersion;
	  };

/**
 * @description Decides, per plugin, whether its local version still needs publishing.
 * @param plugins The plugins in the workspace.
 * @param published The backend's newest version per addon id.
 * @returns One decision per plugin, in the plugins' order.
 */
export function selectPlugins(
	plugins: LocalPlugin[],
	published: PublishedVersions,
): PluginDecision[] {
	return plugins.map((plugin) => decide(plugin, published.get(plugin.id)));
}

/**
 * @description Keeps the decisions that publish.
 * @param decisions The decisions from {@link selectPlugins}.
 * @returns The selected decisions.
 */
export function getSelected(
	decisions: PluginDecision[],
): Extract<PluginDecision, SelectedStatus>[] {
	return decisions.filter((decision) => decision.status === 'selected');
}

type SelectedStatus = {
	status: 'selected';
};

function sameDigests(left: Record<string, string> = {}, right: Record<string, string> = {}) {
	const keys = new Set([...Object.keys(left), ...Object.keys(right)]);

	return [...keys].every((key) => left[key] === right[key]);
}

function isRebuilt(plugin: LocalPlugin, published: PublishedVersion): boolean {
	if (!plugin.sha256 || !published.sha256) return false;

	return plugin.sha256 !== published.sha256 || !sameDigests(plugin.bytecode, published.bytecode);
}

function decide(plugin: LocalPlugin, published: PublishedVersion | undefined): PluginDecision {
	if (!published) {
		return { status: 'selected', reason: 'unpublished', plugin };
	}

	const order = Bun.semver.order(plugin.version, published.version);

	if (order > 0) {
		return { status: 'selected', reason: 'newer', plugin, published };
	}

	if (order === 0 && isRebuilt(plugin, published)) {
		return { status: 'selected', reason: 'rebuilt', plugin, published };
	}

	return {
		status: 'skipped',
		reason: order === 0 ? 'already-published' : 'behind-published',
		plugin,
		published,
	};
}

export default {
	selectPlugins,
	getSelected,
};
