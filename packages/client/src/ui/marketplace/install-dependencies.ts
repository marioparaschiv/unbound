import type { PublishedManifest } from '@unbound-app/contracts/manifest';
import type { ListedAddon } from '@unbound-app/contracts/addons';

import { dependentsOf, planDependencies, type ListedDependency } from '~/addons/dependencies';
import { confirm, showDialog } from '~/dialogs/api';
import MarketplaceStore from '~/marketplace/state';
import { toRelease } from '~/addons/versions';
import { messages, format } from '~/i18n/api';
import { Manager } from '~/addons/manager';
import { show } from '~/toasts/api';

function listedPlugins(): Map<string, ListedAddon> {
	const { state } = MarketplaceStore.getState();

	if (state.status !== 'ready') {
		return new Map();
	}

	return new Map(
		state.catalog.addons
			.filter((listed) => listed.latestVersion.manifest.type !== 'theme')
			.map((listed) => [listed.id, listed]),
	);
}

function asDependency(listed: ListedAddon): ListedDependency {
	const { manifest, version } = listed.latestVersion;

	return { id: listed.id, name: manifest.name, version, dependencies: manifest.dependencies };
}

function describePlan(install: ListedDependency[], update: ListedDependency[]): string {
	const plugins = Manager.for('plugin').getEntities();
	const lines = [
		...install.map((dependency) =>
			format('UNBOUND_DEPENDENCY_INSTALL', { name: dependency.name }),
		),
		...update.map((dependency) => {
			const affected = dependentsOf(dependency.id, plugins).length;

			return format('UNBOUND_DEPENDENCY_UPDATE', {
				name: dependency.name,
				version: dependency.version,
				affected,
			});
		}),
	];

	return lines.join('\n');
}

/**
 * @description Before a plugin installs from the store, installs or updates the plugins it depends on,
 * each after what it needs itself, once the user agrees. Nothing installs when a dependency cannot be
 * satisfied or the user cancels.
 * @param manifest The manifest of the plugin version about to install.
 * @returns Whether its dependencies are in place, so the plugin itself can install.
 */
export async function installDependencies(manifest: PublishedManifest): Promise<boolean> {
	const manager = Manager.for('plugin');
	const listed = listedPlugins();
	const installed = new Map(manager.getEntities().map((entity) => [entity.id, entity.version]));
	const plan = planDependencies(
		manifest.dependencies,
		installed,
		new Map([...listed].map(([id, entry]) => [id, asDependency(entry)])),
	);
	const { name } = manifest;

	if (plan.unavailable.length) {
		showDialog({
			title: format('UNBOUND_DEPENDENCIES_TITLE', { name }),
			body: format('UNBOUND_DEPENDENCIES_UNAVAILABLE', {
				names: plan.unavailable.join(', '),
			}),
			cancel: messages.UNBOUND_OK,
		});

		return false;
	}

	if (plan.ordered.length === 0) {
		return true;
	}

	const approved = await confirm({
		title: format('UNBOUND_DEPENDENCIES_TITLE', { name }),
		body: `${format('UNBOUND_DEPENDENCIES_BODY', { count: plan.ordered.length })}\n\n${describePlan(plan.install, plan.update)}`,
		confirmLabel: messages.UNBOUND_DEPENDENCIES_CONFIRM,
		cancelLabel: messages.UNBOUND_CANCEL,
	});

	if (!approved) {
		return false;
	}

	for (const dependency of plan.ordered) {
		const entry = listed.get(dependency.id);
		const done = entry
			? await manager.applyRelease(dependency.id, toRelease(entry.id, entry.latestVersion))
			: false;

		if (!done) {
			show({
				title: messages.UNBOUND_MARKETPLACE,
				content: format('UNBOUND_DEPENDENCY_FAILED', { name: dependency.name }),
				icon: 'CircleXIcon',
			});

			return false;
		}
	}

	return true;
}

export default installDependencies;
