import { Addon } from '@typings/managers';
import Manager, { ManagerType } from './base';
import Storage from '@api/storage';
import { Keys } from '@constants';

class Plugins extends Manager {
	public extension: string = 'js';

	constructor() {
		super(ManagerType.Plugins);

		this.icon = 'StaffBadgeIcon';
	}

	initialize() {
		for (const plugin of window.UNBOUND_PLUGINS ?? []) {
			const { manifest, bundle } = plugin;

			this.load(bundle, manifest);
		}
	}

	override getContextItems(addon: Addon, navigation: any) {
		return [
			...addon.instance?.settings ? [{
				label: 'SETTINGS',
				icon: 'settings',
				action: () => navigation.push(Keys.Custom, {
					title: addon.data.name,
					render: addon.instance.settings
				})
			}] : [],
			...this.getBaseContextItems(addon)
		];
	}

	override handleBundle(bundle: string) {
		if (Storage.get('unbound', 'recovery', false)) {
			return {
				start: () => { },
				stop: () => { }
			};
		}

		const iife = eval(`() => { return ${bundle} }`);
		const payload = iife();
		const res = typeof payload === 'function' ? payload() : payload;

		return res.default ?? res;
	}
}

export default new Plugins();