/** A first-party plugin as its directory describes it. */
export type LocalPlugin = {
	id: string;
	/** The plugin's directory, relative to `packages/plugins`. */
	dir: string;
	version: string;
	/** The built bundle, relative to `packages/plugins`. */
	bundle: string;
};

/** The newest version the backend published for an addon, delisted or not, and the commit it was read from. */
export type PublishedVersion = {
	version: string;
	commitSha: string | null;
};

export type PublishedVersions = Map<string, PublishedVersion>;

export type PluginDecision =
	| { status: 'selected'; reason: 'unpublished'; plugin: LocalPlugin }
	| { status: 'selected'; reason: 'newer'; plugin: LocalPlugin; published: PublishedVersion }
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

function decide(plugin: LocalPlugin, published: PublishedVersion | undefined): PluginDecision {
	if (!published) {
		return { status: 'selected', reason: 'unpublished', plugin };
	}

	const order = Bun.semver.order(plugin.version, published.version);

	if (order > 0) {
		return { status: 'selected', reason: 'newer', plugin, published };
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
