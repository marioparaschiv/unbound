import type { ManagerKind } from '@unbound-app/types/addons';
import { createLogger } from '@unbound-app/logger';

import type { DefaultEventMap } from '~/lib/event-emitter';
import { EventEmitter } from '~/lib/event-emitter';
import { createPatcher } from '~/api/patcher';
import storage from '~/api/storage';

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
export abstract class Manager<T, EventMap extends DefaultEventMap = {}> extends EventEmitter<
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
	constructor(public readonly type: ManagerKind) {
		super();

		const name = type.toUpperCase();

		this.logger = createLogger(name);
		this.settings = storage.getStore(type);
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
	 * @description Reads the URL each entity was installed from. Entities loaded from disk or pushed
	 * over the debugger have none.
	 * @returns A record of entity id to install URL.
	 */
	getSources(): Record<string, string> {
		return this.settings.get('sources', {});
	}

	/**
	 * @description Records the URL an entity was installed from. Twin of {@link forgetSource}.
	 * @param id The entity id.
	 * @param url The install URL.
	 */
	recordSource(id: string, url: string) {
		this.settings.set('sources', { ...this.getSources(), [id]: url });
	}

	/**
	 * @description Forgets the URL an entity was installed from. Twin of {@link recordSource}.
	 * @param id The entity id.
	 */
	forgetSource(id: string) {
		const { [id]: removed, ...sources } = this.getSources();

		if (removed === undefined) return;

		this.settings.set('sources', sources);
	}

	/**
	 * @description Tears the manager down, reverting all patches and clearing its entities and errors.
	 */
	shutdown(): void | Promise<void> {
		this.patcher.unpatchAll();
		this.entities.clear();
		this.errors.clear();
		this.initialized = false;
	}
}
