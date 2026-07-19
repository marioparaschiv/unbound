import { createLogger } from '@unbound-app/logger';
import { createPatcher } from 'possess';
import { EventEmitter } from 'tseep';

import storage from '~/api/storage';

/** Discriminates the kind of addon a {@link Manager} subclass governs. */
export enum ManagerType {
	PLUGINS,
	THEMES,
	ICONS,
	FONTS,
}

type BaseManagerEvents<T> = {
	load: (entity: T) => void;
	unload: (entity: T) => void;
};

/**
 * @description Base contract every addon-style manager subclasses. Extends tseep's `EventEmitter`,
 * intersecting `BaseManagerEvents<T>` (the `load`/`unload` pair) onto the subclass event map, and
 * holds an `entities` map of governed addons alongside an `errors` map recording per-entity failures.
 * @template T The entity type the manager governs.
 * @template EventMap The subclass-specific event map, merged with `BaseManagerEvents<T>`.
 */
export abstract class Manager<T, EventMap extends Record<string, any> = {}> extends EventEmitter<
	EventMap & BaseManagerEvents<T>
> {
	/** The entities currently governed by this manager, keyed by id. */
	entities = new Map<PropertyKey, T>();
	/** Errors recorded per entity id when an operation fails. */
	errors = new Map<PropertyKey, Error>();
	/** Whether {@link initialize} has completed for this manager. */
	initialized = false;

	protected logger: ReturnType<typeof createLogger>;
	protected settings: ReturnType<typeof storage.getStore>;
	protected patcher: ReturnType<typeof createPatcher>;

	/**
	 * @description Constructs the manager, deriving its logger, settings store, and patcher from the type.
	 * @param type The kind of addon this manager governs.
	 */
	constructor(public readonly type: ManagerType) {
		super();

		const name = ManagerType[type];

		this.logger = createLogger(name);
		this.settings = storage.getStore(name.toLowerCase());
		this.patcher = createPatcher(name);
	}

	/**
	 * @description Sets up the manager and loads its entities. Implemented by each subclass.
	 */
	abstract initialize(): void;

	/**
	 * @description Lists every entity currently governed by this manager.
	 * @returns An array of all governed entities.
	 */
	getEntities(): T[] {
		return [...this.entities.values()];
	}

	/**
	 * @description Looks up a single governed entity by its id.
	 * @param id The id of the entity to retrieve.
	 * @returns The matching entity, or `undefined` if none is governed under that id.
	 */
	getEntity(id: PropertyKey): T | undefined {
		return this.entities.get(id);
	}

	/**
	 * @description Tears the manager down, reverting all patches and clearing its entities and errors.
	 */
	shutdown() {
		this.patcher.unpatchAll();
		this.entities.clear();
		this.errors.clear();
		this.initialized = false;
	}
}
