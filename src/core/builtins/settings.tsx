import type { BuiltIn } from '@typings/core/builtins';
import type { Manager } from '@typings/managers';
import { registerSettings } from '@api/settings';
import * as Components from '@metro/components';
import { TrailingText } from '@ui/misc/forms';
import { ClientName, Keys } from '@constants';
import General from '@ui/settings/general';
import Plugins from '@ui/settings/plugins';
import Sources from '@ui/settings/sources';
import Design from '@ui/settings/design';
import * as Managers from '@managers';
import { Strings } from '@api/i18n';
import { Icons } from '@api/assets';

type CustomScreenProps = {
	title: string;
	render: React.ComponentType;
};

export const data: BuiltIn['data'] = {
	id: 'modules.misc',
	default: true
};

function useAddonsCount(...managers: Manager[]) {
	return managers.reduce((total, manager) => total + Managers[manager].useEntities().length, 0);
}

function AddonCount({ managers, manipulator }: { managers: Manager[], manipulator?: Fn; }) {
	const amount = useAddonsCount(...managers);
	const value = typeof manipulator === 'function' ? manipulator(amount) : amount;

	// When there are no entities, do not render a count.
	if (!value) return null;

	return <TrailingText>
		{Strings.UNBOUND_ADDON_INSTALLED_AMOUNT.format({ amount: value })}
	</TrailingText>;
}

export function initialize() {
	registerSettings({
		label: ClientName,
		entries: [
			{
				title: 'SETTINGS',
				id: Keys['General'],
				icon: Icons['settings'],
				keywords: [Strings.UNBOUND_GENERAL],
				screen: General,
				useTrailing: () => <TrailingText>{window.unbound.version}</TrailingText>
			},
			{
				title: 'UNBOUND_PLUGINS',
				id: Keys['Plugins'],
				icon: Icons['debug'],
				screen: Plugins,
				useTrailing: () => <AddonCount managers={['Plugins']} />
			},
			{
				title: 'UNBOUND_DESIGN',
				id: Keys['Design'],
				icon: Icons['ic_theme_24px'],
				keywords: [Strings.UNBOUND_THEMES, Strings.UNBOUND_ICONS, Strings.UNBOUND_FONTS],
				screen: Design,
				// Themes + Icons installed accounting for the default icon pack
				useTrailing: () => <AddonCount managers={['Themes', 'Icons']} manipulator={(amount) => amount - 1} />
			},
			{
				title: 'UNBOUND_SOURCES',
				id: Keys['Sources'],
				icon: Icons['grid'],
				screen: Sources,
				useTrailing: () => <AddonCount managers={['Sources']} />
			},
			{
				title: 'Page',
				id: Keys['Custom'],
				icon: null,
				mappable: false,
				screen: ({ title, render: Component, ...props }: CustomScreenProps) => {
					const navigation = Components.Design.useNavigation();

					const unsubscribe = navigation.addListener('focus', () => {
						unsubscribe();
						navigation.setOptions({ title });
					});

					return <Component {...props} />;
				}
			}
		]
	});
}

export function shutdown() { }