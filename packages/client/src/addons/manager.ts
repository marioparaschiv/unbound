import type { AddonKind } from '@unbound-app/types/addons';
import { createLogger } from '@unbound-app/logger';

import type { DefaultEventMap } from '~/core/event-emitter';
import { createPatcher } from '~/patcher/create-patcher';
import type { ManagerOf } from '~/addons/manager-of';
import { EventEmitter } from '~/core/event-emitter';
import storage from '~/storage/api';

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
	/** The message key of the kind's plural as a sentence reads it, cased per locale. */
	noun: string;
	/** The asset name that stands in for an addon's own icon. */
	icon: string;
};

const registry: Partial<ManagerOf> = {};

/**
 * @description Base contract every addon-style manager subclasses. Extends tseep's `EventEmitter` with the
 * subclass event map, and holds an `addons` map of governed addons alongside an `errors` map recording
 * per-addon failures.
 * @template T The addon type the manager governs.
 * @template EventMap The subclass-specific event map.
 */
export abstract class Manager<
	T,
	EventMap extends DefaultEventMap = {},
> extends EventEmitter<EventMap> {
	/** The addons currently governed by this manager, keyed by id. */
	addons = new Map<PropertyKey, T>();
	/** Errors recorded per addon id when an operation fails. */
	errors = new Map<PropertyKey, Error>();

	readonly kind: AddonKind;
	readonly name: string;
	readonly directory: string;
	readonly bucket: string;
	readonly label: string;
	readonly noun: string;
	readonly icon: string;

	protected logger: ReturnType<typeof createLogger>;
	protected settings: ReturnType<typeof storage.getBucket>;
	protected patcher: ReturnType<typeof createPatcher>;

	/**
	 * @description Constructs the manager, creating its logger and patcher from its name and its settings from its bucket.
	 * @param info The manager's kind, name, directory, bucket, label, noun and icon.
	 */
	constructor(info: ManagerInfo) {
		super();

		this.kind = info.kind;
		this.name = info.name;
		this.directory = info.directory;
		this.bucket = info.bucket;
		this.label = info.label;
		this.noun = info.noun;
		this.icon = info.icon;

		this.logger = createLogger(info.name);
		this.settings = storage.getBucket(info.bucket);
		this.patcher = createPatcher(info.name);
	}

	/**
	 * @description Resolves the manager singleton of an addon kind, once core has registered it.
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
	 * @description Makes each kind's manager the singleton {@link Manager.for} resolves. Twin of {@link unregister}.
	 * @param managers Every kind's manager.
	 */
	static register(managers: ManagerOf) {
		Object.assign(registry, managers);
	}

	/**
	 * @description Forgets every registered manager, so {@link Manager.for} throws again. Twin of {@link register}.
	 */
	static unregister() {
		for (const kind of Object.keys(registry) as AddonKind[]) {
			delete registry[kind];
		}
	}

	/**
	 * @description Sets up the manager and loads its addons. Implemented by each subclass.
	 */
	abstract initialize(): void;

	getAddons(): T[] {
		return [...this.addons.values()];
	}

	getAddon(id: PropertyKey): T | undefined {
		return this.addons.get(id);
	}

	/**
	 * @description Tears the manager down, reverting all patches and clearing its addons and errors.
	 */
	shutdown(): void | Promise<void> {
		this.patcher.unpatchAll();
		this.addons.clear();
		this.errors.clear();
	}
}
