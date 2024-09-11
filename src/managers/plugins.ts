import { type Addon, type Manifest } from '@typings/managers';
import Storage from '@api/storage';

import Manager, { ManagerKind } from './base';

class Plugins extends Manager {
	public extension: string = 'js';

	constructor() {
		super(ManagerKind.PLUGINS);

		this.icon = 'StaffBadgeIcon';
	}

	initialize() {
		for (const plugin of window.UNBOUND_PLUGINS ?? []) {
			const { manifest, bundle } = plugin;

			this.load(bundle, manifest);
		}

		this.initialized = true;
	}

	override getContextItems(addon: Addon) {
		// const navigation = Design.useNavigation();

		return [
			addon.instance?.settings ? {
				label: 'SETTINGS',
				icon: 'settings',
				action: () => { }/* navigation.push(Keys.Custom, {
					title: addon.data.name,
					render: addon.instance.settings
				}) */
			} : null,
			...this.getBaseContextItems(addon)
		].filter(Boolean);
	}

	override handleBundle(bundle: string, manifest: Manifest) {
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