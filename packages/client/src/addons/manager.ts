import type { AddonKind } from '@unbound-app/types/addons';
import { createLogger } from '@unbound-app/logger';

import type { DefaultEventMap } from '~/core/event-emitter';
import type { ManagerOf } from '~/addons/manager-of';
import { EventEmitter } from '~/core/event-emitter';
import { createPatcher } from '~/patcher/api';
import storage from '~/storage/api';

type BaseManagerEvents<T> = {
	load: (entity: T) => void;
	unload: (entity: T) => void;
};

/** What a manager is called, where it keeps its addons, and how the UI shows its kind. */
export type ManagerInfo = {
	kind: AddonKind;
	/** The logger and patcher name. */
	name: string;
	/** The folder its addons live in, relative to the documents directory, cased as the loader scans it. */
	directory: string;
	/** The bucket its settings persist to. */
	bucket: string;
	/** The message key of the tab and section label. */
	label: string;
	/** The asset name that stands in for an addon's own icon. */
	icon: string;
};

const registry: Partial<ManagerOf> = {};

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

	readonly kind: AddonKind;
	readonly name: string;
	readonly directory: string;
	readonly bucket: string;
	readonly label: string;
	readonly icon: string;

	protected logger: ReturnType<typeof createLogger>;
	protected settings: ReturnType<typeof storage.getStore>;
	protected patcher: ReturnType<typeof createPatcher>;

	/**
	 * @description Constructs the manager, creating its logger and patcher from its name and its settings from its bucket.
	 * @param info The manager's kind, name, directory, bucket, label and icon.
	 */
	constructor(info: ManagerInfo) {
		super();

		this.kind = info.kind;
		this.name = info.name;
		this.directory = info.directory;
		this.bucket = info.bucket;
		this.label = info.label;
		this.icon = info.icon;

		this.logger = createLogger(info.name);
		this.settings = storage.getStore(info.bucket);
		this.patcher = createPatcher(info.name);
	}

	/**
	 * @description Resolves the manager singleton of an addon kind. Twin of {@link register}.
	 * @template K The addon kind.
	 * @param kind The addon kind.
	 * @returns The kind's manager.
	 */
	static for<K extends AddonKind>(kind: K): ManagerOf[K] {
		const manager = registry[kind];

		if (!manager) {
			throw new Error(`No manager is registered for ${kind} addons.`);
		}

		return manager;
	}

	/**
	 * @description Makes a manager the singleton {@link Manager.for} resolves for its kind. Twin of {@link for}.
	 * @template K The addon kind.
	 * @param kind The addon kind.
	 * @param manager The kind's manager.
	 */
	protected static register<K extends AddonKind>(kind: K, manager: ManagerOf[K]) {
		registry[kind] = manager;
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
