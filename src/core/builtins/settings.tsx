import { Icons } from '@api/assets';
import { Strings } from '@api/i18n';
import { ClientName, Keys } from '@constants';
import { Redesign } from '@metro/components';
import type { BuiltIn } from '@typings/core/builtins';
import Design from '@ui/settings/design';
import General from '@ui/settings/general';
import Plugins from '@ui/settings/plugins';
import { registerSettings } from '@utilities/registerSettings';

type CustomScreenProps = {
	title: string;
	render: React.ComponentType;
};

export const data: BuiltIn['data'] = {
	id: 'modules.misc',
	default: true
};

export function initialize() {
	registerSettings({
		label: ClientName,
		entries: [
			{
				title: 'SETTINGS',
				id: Keys['General'],
				icon: Icons['settings'],
				keywords: [Strings.UNBOUND_GENERAL],
				screen: General
			},
			{
				title: 'UNBOUND_PLUGINS',
				id: Keys['Plugins'],
				icon: Icons['debug'],
				screen: Plugins
			},
			{
				title: 'UNBOUND_DESIGN',
				id: Keys['Design'],
				icon: Icons['PencilSparkleIcon'],
				keywords: [Strings.UNBOUND_THEMES, Strings.UNBOUND_ICONS, Strings.UNBOUND_FONTS],
				screen: Design
			},
			{
				title: 'UNBOUND_UPDATER',
				id: Keys['Updater'],
				icon: Icons['ic_download_24px'],
				screen: () => null
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

export function shutdown() {
}