import type { Plugin } from '@typings/managers/plugins';
import { ManagerKind } from '@constants';
import Addons from '@managers/addons';
import Storage from '@api/storage';

class Plugins extends Addons<Plugin> {
	extension: string = 'js';

	constructor() {
		super(ManagerKind.PLUGINS);
	}

	override initialize() {
		for (const plugin of window.UNBOUND_PLUGINS ?? []) {
			const { manifest, bundle } = plugin;

			this.load(bundle, manifest);
		}

		this.initialized = true;
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