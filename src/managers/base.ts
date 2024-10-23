import { ManagerNames, ManagerType, type ManagerKind } from '@constants';
import { createLogger } from '@structures/logger';
import EventEmitter from '@structures/emitter';
import { createPatcher } from '@api/patcher';
import { getStore } from '@api/storage';

class Manager<T extends any> extends EventEmitter {
	type: ManagerType = ManagerType.BASE;
	initialized: boolean = false;
	name: string;

	entities: Map<PropertyKey, T> = new Map();
	errors: Map<PropertyKey, Error> = new Map();

	logger: ReturnType<typeof createLogger>;
	patcher: ReturnType<typeof createPatcher>;
	settings: ReturnType<typeof getStore>;

	constructor(kind: ManagerKind) {
		super();

		this.name = ManagerNames[kind];
		this.logger = createLogger('Managers', this.name);
		this.patcher = createPatcher(`unbound::managers::${this.name.toLowerCase()}`);
		this.settings = getStore(this.name.toLowerCase());
	}

	load(...args: any[]) {
		throw new Error('Not implemented.');
	}

	unload(...args: any[]) {
		throw new Error('Not implemented.');
	}

	getEntities() {
		return [...this.entities.values()];
	}
}

export default Manager;