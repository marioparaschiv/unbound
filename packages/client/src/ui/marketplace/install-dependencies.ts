import type { AddonRelease } from '@unbound-app/contracts/updates';
import type { ListedAddon } from '@unbound-app/contracts/addons';
import { Alert } from 'react-native';

import { dependentsOf, planDependencies, type ListedDependency } from '~/lib/addon-dependencies';
import MarketplaceStore from '~/stores/marketplace';
import { Messages, format } from '~/api/i18n';
import { ManagerKind } from '~/lib/constants';
import { getManager } from '~/managers/utils';
import { showToast } from '~/api/toasts';

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

function toRelease(listed: ListedAddon): AddonRelease {
	const { version, manifestUrl, bundleUrl, sha256, changelog, changes } = listed.latestVersion;

	return { id: listed.id, version, manifestUrl, bundleUrl, sha256, changelog, changes };
}

function ask(title: string, message: string, confirm: string): Promise<boolean> {
	return new Promise((resolve) => {
		Alert.alert(
			title,
			message,
			[
				{ text: Messages.UNBOUND_CANCEL, style: 'cancel', onPress: () => resolve(false) },
				{ text: confirm, onPress: () => resolve(true) },
			],
			{ cancelable: true, onDismiss: () => resolve(false) },
		);
	});
}

function describePlan(install: ListedDependency[], update: ListedDependency[]): string {
	const plugins = getManager(ManagerKind.Plugins).getEntities();
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
 * @param addon The listed plugin about to install.
 * @returns Whether its dependencies are in place, so the plugin itself can install.
 */
export async function installDependencies(addon: ListedAddon): Promise<boolean> {
	const manager = getManager(ManagerKind.Plugins);
	const listed = listedPlugins();
	const installed = new Map(
		manager.getEntities().map((entity) => [entity.id, entity.data.version]),
	);
	const plan = planDependencies(
		addon.latestVersion.manifest.dependencies,
		installed,
		new Map([...listed].map(([id, entry]) => [id, asDependency(entry)])),
	);
	const name = addon.latestVersion.manifest.name;

	if (plan.unavailable.length) {
		Alert.alert(
			format('UNBOUND_DEPENDENCIES_TITLE', { name }),
			format('UNBOUND_DEPENDENCIES_UNAVAILABLE', { names: plan.unavailable.join(', ') }),
		);

		return false;
	}

	if (plan.ordered.length === 0) {
		return true;
	}

	const approved = await ask(
		format('UNBOUND_DEPENDENCIES_TITLE', { name }),
		`${format('UNBOUND_DEPENDENCIES_BODY', { count: plan.ordered.length })}\n\n${describePlan(plan.install, plan.update)}`,
		Messages.UNBOUND_DEPENDENCIES_CONFIRM,
	);

	if (!approved) {
		return false;
	}

	for (const dependency of plan.ordered) {
		const entry = listed.get(dependency.id);
		const done = entry
			? installed.has(dependency.id)
				? await manager
						.update(dependency.id, toRelease(entry))
						.then(
							() =>
								manager.getEntity(dependency.id)?.data.version ===
								dependency.version,
						)
				: Boolean(await manager.install(entry.latestVersion.manifestUrl))
			: false;

		if (!done) {
			showToast({
				title: Messages.UNBOUND_MARKETPLACE,
				content: format('UNBOUND_DEPENDENCY_FAILED', { name: dependency.name }),
				icon: 'CircleXIcon',
			});

			return false;
		}
	}

	return true;
}

export default installDependencies;
