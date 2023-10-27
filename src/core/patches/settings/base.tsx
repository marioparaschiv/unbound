import { ClientName } from '@constants';
import { i18n } from '@metro/common';
import { Navigation } from '@metro/components';
import { createPatcher } from '@patcher';

import General from '@ui/settings/pages/general';
import Plugins from '@ui/settings/pages/plugins';
import Design from '@ui/settings/pages/design';

export class Settings {
	public patcher: ReturnType<typeof createPatcher>;

	constructor(name: string) {
		this.patcher = createPatcher(`${name}-settings`);
	}

	public Titles = {
		get General() {
			return i18n.Messages.SETTINGS;
		},

		get Plugins() {
			return i18n.Messages.UNBOUND_PLUGINS;
		},

		get Design() {
			return i18n.Messages.UNBOUND_DESIGN;
		},

		get Updater() {
			return i18n.Messages.UNBOUND_UPDATER;
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
		Custom: ({ title, render: Component, ...props }: { title: string; render: React.ComponentType; }) => {
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