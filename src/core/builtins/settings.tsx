import { registerSettings } from '@utilities/registerSettings';
import type { BuiltIn } from '@typings/core/builtins';
import { ReactNative as RN } from '@metro/common';
import { ClientName, Keys } from '@constants';
import { Redesign } from '@metro/components';
import * as Managers from '@managers';
import { Strings } from '@api/i18n';
import { Icons } from '@api/assets';


import Design from '@ui/settings/design';
import General from '@ui/settings/general';
import Plugins from '@ui/settings/plugins';
import Sources from '@ui/settings/sources';
import { TrailingText, useFormStyles } from '@ui/components/misc';
import type { Manager } from '@typings/managers';

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

function AddonCount({ managers, manipulator }: { managers: Manager[], manipulator?: Fn }) {
	const amount = useAddonsCount(...managers);

	return <TrailingText>
		{Strings.UNBOUND_ADDON_INSTALLED_AMOUNT.format({
			amount: typeof manipulator === 'function' ? manipulator(amount) : amount
		})}
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
				icon: Icons['PencilSparkleIcon'],
				keywords: [Strings.UNBOUND_THEMES, Strings.UNBOUND_ICONS, Strings.UNBOUND_FONTS],
				screen: Design,
				// Themes + Icons installed accounting for the default icon pack
				useTrailing: () => <AddonCount managers={['Themes', 'Icons']} manipulator={(amount) => amount - 1}/>
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
					const navigation = Redesign.useNavigation();

					const unsubscribe = navigation.addListener('focus', () => {
						unsubscribe();
						navigation.setOptions({ title });
					});

					return <Component { ...props } />;
				}
			}
		]
	});
}

export function shutdown() {}