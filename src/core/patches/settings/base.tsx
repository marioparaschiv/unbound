import { Navigation } from '@metro/components';
import { createPatcher } from '@patcher';
import { ClientName } from '@constants';
import { Strings } from '@api/i18n';

import General from '@ui/settings/general';
import Plugins from '@ui/settings/plugins';
import Design from '@ui/settings/design';

type CustomScreenProps = {
	title: string;
	render: React.ComponentType;
};

export class Settings {
	public patcher: ReturnType<typeof createPatcher>;

	constructor(name: string) {
		this.patcher = createPatcher(`${name}-settings`);
	}

	public Titles = {
		get General() {
			return Strings.SETTINGS;
		},

		get Plugins() {
			return Strings.UNBOUND_PLUGINS;
		},

		get Design() {
			return Strings.UNBOUND_DESIGN;
		},

		get Updater() {
			return Strings.UNBOUND_UPDATER;
		},

		get Custom() {
			return 'Page';
		}
	};

	public Icons = {
		General: null,
		Plugins: null,
		Design: null,
		Updater: null,
		Custom: null
	};

	public Breadcrumbs = {
		General: [ClientName],
		Plugins: [ClientName],
		Design: [ClientName],
		Updater: [ClientName],
		Custom: []
	};

	public Keywords = {
		get General() {
			return [Strings.UNBOUND_GENERAL];
		},

		get Plugins() {
			return [];
		},

		get Design() {
			return [Strings.UNBOUND_THEMES, Strings.UNBOUND_ICONS, Strings.UNBOUND_FONTS];
		},

		get Updater() {
			return [];
		},

		get Custom() {
			return [];
		},
	};

	public Mappables = {
		General: true,
		Plugins: true,
		Design: true,
		Updater: true,
		Custom: false
	};

	public Screens = {
		General,
		Plugins,
		Design,
		Updater: () => null,
		Custom: ({ title, render: Component, ...props }: CustomScreenProps) => {
			const navigation = Navigation.useNavigation();

			const unsubscribe = navigation.addListener('focus', () => {
				unsubscribe();
				navigation.setOptions({ title });
			});

			return <Component {...props} />;
		}
	};

	public apply() {
		return null;
	}

	public remove() {
		return null;
	}
}