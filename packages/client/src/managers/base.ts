import { createLogger } from '@unbound-app/logger';
import { createPatcher } from 'possess';
import { EventEmitter } from 'tseep';

import storage from '~/api/storage';

export enum ManagerType {
	PLUGINS,
	THEMES,
}

type BaseManagerEvents<T> = {
	load: (entity: T) => void;
	unload: (entity: T) => void;
};

export abstract class Manager<T, EventMap extends Record<string, any> = {}> extends EventEmitter<
	EventMap & BaseManagerEvents<T>
> {
	entities = new Map<PropertyKey, T>();
	errors = new Map<PropertyKey, Error>();
	initialized = false;

	protected logger: ReturnType<typeof createLogger>;
	protected settings: ReturnType<typeof storage.getStore>;
	protected patcher: ReturnType<typeof createPatcher>;

	constructor(public readonly type: ManagerType) {
		super();

		const name = ManagerType[type];

		this.logger = createLogger(name);
		this.settings = storage.getStore(name.toLowerCase());
		this.patcher = createPatcher(name);
	}

	abstract initialize(): void;

	getEntities(): T[] {
		return [...this.entities.values()];
	}

	getEntity(id: PropertyKey): T | undefined {
		return this.entities.get(id);
	}

	shutdown() {
		this.patcher.unpatchAll();
		this.entities.clear();
		this.errors.clear();
		this.initialized = false;
	}
}
