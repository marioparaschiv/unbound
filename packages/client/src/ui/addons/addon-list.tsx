import { Pressable } from 'react-native';
import { memo } from 'react';

import { useUnboundSettings } from '~/settings/unbound';
import sampleAddons from '~/plugins/sample-addons';
import { isLibrary } from '~/addons/dependencies';
import { Messages, format } from '~/i18n/api';
import { Discord } from '~/metro/components';
import { Empty } from '~/ui/components';
import { DEV } from '~/core/constants';
import { useAddons } from '~/ui/hooks';

import AddonCard from './addon-card';

type AddonListProps = {
	kind: 'plugin' | 'theme' | 'icon-pack';
};

/**
 * @description Renders a manager's addons as cards, or an empty state when there are none. Subscribes
 * to the manager through {@link useAddons}, so installs, deletes, and toggles reflect automatically.
 * Library plugins stay hidden behind a toggle that counts them.
 */
function AddonList({ kind }: AddonListProps) {
	const managedAddons = useAddons(kind);
	const settings = useUnboundSettings(({ key }) => key === 'plugins.showLibraries');
	const showLibraries = settings.get('plugins.showLibraries');
	const all = DEV && kind === 'plugin' && !managedAddons.length ? sampleAddons : managedAddons;
	const libraries = new Set(
		kind === 'plugin'
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
		return (
			<>
				<Empty image='empty_permission'>
					{format('UNBOUND_NO_ADDONS', { type: kind })}
				</Empty>
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
