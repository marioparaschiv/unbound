import { Pressable } from 'react-native';
import { memo } from 'react';

import { ManagerKind, ManagerNames, DEV } from '~/lib/constants';
import { isLibrary } from '~/lib/addon-dependencies';
import { Discord } from '~/api/metro/components';
import { useSettingsStore } from '~/api/storage';
import { Messages, format } from '~/api/i18n';
import { Empty } from '~/ui/components';
import { useAddons } from '~/ui/hooks';

import sampleAddons from './sample-addons';
import AddonCard from './addon-card';

type AddonListProps = {
	kind: ManagerKind.Plugins | ManagerKind.Themes | ManagerKind.Icons;
};

/**
 * @description Renders a manager's addons as cards, or an empty state when there are none. Subscribes
 * to the manager through {@link useAddons}, so installs, deletes, and toggles reflect automatically.
 * Library plugins stay hidden behind a toggle that counts them.
 */
function AddonList({ kind }: AddonListProps) {
	const managedAddons = useAddons(kind);
	const settings = useSettingsStore('unbound', ({ key }) => key === 'plugins.showLibraries');
	const showLibraries = settings.get('plugins.showLibraries', false);
	const all =
		DEV && kind === ManagerKind.Plugins && !managedAddons.length ? sampleAddons : managedAddons;
	const libraries = new Set(
		kind === ManagerKind.Plugins
			? all.filter((addon) => isLibrary(addon, all)).map((addon) => addon.id)
			: [],
	);
	const addons = showLibraries ? all : all.filter((addon) => !libraries.has(addon.id));
	const toggle = libraries.size ? (
		<Pressable
			accessibilityRole='button'
			onPress={() => settings.set('plugins.showLibraries', !showLibraries)}
			style={{ alignSelf: 'center', paddingVertical: 8 }}
		>
			<Discord.Text variant='text-sm/semibold' color='text-muted'>
				{showLibraries
					? Messages.UNBOUND_HIDE_LIBRARIES
					: format('UNBOUND_SHOW_LIBRARIES', { count: libraries.size })}
			</Discord.Text>
		</Pressable>
	) : null;

	if (!addons.length) {
		const type = ManagerNames[kind].toLowerCase();

		return (
			<>
				<Empty image='empty_permission'>{format('UNBOUND_NO_ADDONS', { type })}</Empty>
				{toggle}
			</>
		);
	}

	return (
		<>
			{addons.map((addon) => (
				<AddonCard
					key={addon.id}
					addon={addon}
					kind={kind}
					library={libraries.has(addon.id)}
				/>
			))}
			{toggle}
		</>
	);
}

export default memo(AddonList);
