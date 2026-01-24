import type { Plugin, PluginEntity } from '@unbound-app/types';

import { ManagerType } from './base';
import { Addons } from './addons';

export class Plugins extends Addons<PluginEntity> {
	constructor() {
		super(ManagerType.PLUGINS);
	}

	initialize() {
		for (const { bundle, manifest } of window.UNBOUND_PLUGINS ?? []) {
			this.load(bundle, manifest);
		}

		this.initialized = true;
	}

	protected handleBundle(bundle: string): Plugin {
		// oxlint-disable-next-line no-eval
		const iife = eval(`(() => { return ${bundle} })`);
		const payload = iife();
		const instance = typeof payload === 'function' ? payload() : payload;

		return instance?.default ?? instance;
	}
}

export const plugins = new Plugins();
