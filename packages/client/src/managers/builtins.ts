import { createLogger } from '@unbound-app/logger';

import * as allBuiltIns from '~/builtins';
import storage from '~/api/storage';

const Logger = createLogger('BuiltIns');
const Settings = storage.getStore('unbound');

export interface BuiltIn {
	start?: () => void;
	stop?: () => void;
}

class BuiltInsManager {
	private active = new Map<string, BuiltIn>();
	private initialized = false;

	register(name: string, builtin: BuiltIn) {
		if (this.active.has(name)) {
			Logger.warn(`Built-in ${name} already registered`);
			return;
		}

		try {
			builtin.start?.();
			this.active.set(name, builtin);
			Logger.info(`Started built-in: ${name}`);
		} catch (error) {
			Logger.error(`Failed to start built-in ${name}:`, error);
		}
	}

	unregister(name: string) {
		const builtin = this.active.get(name);
		if (!builtin) return;

		try {
			builtin.stop?.();
			this.active.delete(name);
			Logger.info(`Stopped built-in: ${name}`);
		} catch (error) {
			Logger.error(`Failed to stop built-in ${name}:`, error);
		}
	}

	initialize() {
		if (this.initialized) {
			Logger.warn('Built-ins already initialized');
			return;
		}

		for (const [name, builtin] of Object.entries(allBuiltIns)) {
			if (name === 'debug' && !Settings.get('debugger.enabled', false)) {
				continue;
			}

			this.register(name, builtin);
		}

		this.initialized = true;
	}

	shutdown() {
		if (!this.initialized) return;

		for (const [name, builtin] of [...this.active.entries()].reverse()) {
			try {
				builtin.stop?.();
				Logger.info(`Stopped built-in: ${name}`);
			} catch (error) {
				Logger.error(`Failed to stop built-in ${name}:`, error);
			}
		}

		this.active.clear();
		this.initialized = false;
	}

	isInitialized() {
		return this.initialized;
	}
}

export const builtins = new BuiltInsManager();
