import { ClientName } from '@constants';
import { i18n } from '@metro/common';
import { Navigation } from '@metro/components';
import { createPatcher } from '@patcher';

import General from '@ui/settings/pages/general';
import Plugins from '@ui/settings/pages/plugins';
import Design from '@ui/settings/pages/design';

type CustomScreenProps = {
	title: string;
	render: React.ComponentType;
}

const { Messages: M } = i18n;

export class Settings {
	public patcher: ReturnType<typeof createPatcher>;

	constructor(name: string) {
		this.patcher = createPatcher(`${name}-settings`);
	}

	public Titles = {
		get General() {
			return M.SETTINGS;
		},

		get Plugins() {
			return M.UNBOUND_PLUGINS;
		},

		get Design() {
			return M.UNBOUND_DESIGN;
		},

		get Updater() {
			return M.UNBOUND_UPDATER;
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
			return [M.UNBOUND_GENERAL]
		},

		get Plugins() {
			return []
		},

		get Design() {
			return [M.UNBOUND_THEMES, M.UNBOUND_ICONS, M.UNBOUND_FONTS]
		},

		get Updater() {
			return []
		},

		get Custom() {
			return []
		},
	}

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