import noop from '@unbound-app/utils/noop';

// A port of tseep 1.3.1's `EventEmitter` without its eval-baked callers. Plugins reach it through the
// managers, so it keeps every observable tseep behavior, quirks included.

/** Any event listener. tseep's `any[]` parameters become `never[]`, which accepts every listener. */
// UNKNOWN: emitters ignore what a listener's promise resolves to, so any async listener is allowed.
export type Listener = (...args: never[]) => Promise<unknown> | void;

/** The event map of an untyped emitter. `__proto__` is reserved, as in tseep. */
export type DefaultEventMap = Record<string | symbol, Listener> & { __proto__?: never };

/** The declared parameter count of a listener. */
export type ArgsNum<T extends Listener> = Parameters<T>['length'];

type EventName = keyof DefaultEventMap;
type Tasks<Func> = Func[] | Func | null;
// UNKNOWN: listeners receive whatever the emitter was given.
type Caller = (...args: unknown[]) => void;
type Fireable = TaskCollection & { call: Caller };

type EventCollections<EventMap extends DefaultEventMap> = {
	[eventName in keyof EventMap]?: TaskCollection<EventMap[eventName]>;
};

type OnceCollections<EventMap extends DefaultEventMap> = {
	[eventName in keyof EventMap]?: EventMap[eventName][] | EventMap[eventName];
};

/**
 * @description The listeners registered for one event, called in order on emit.
 * @template Func The listener type of the event.
 */
export class TaskCollection<Func extends Listener = Listener> {
	declare argsNum: number;
	declare _tasks: Tasks<Func>;
	declare length: number;
	declare call: (...args: Parameters<Func>) => ReturnType<Listener>;

	/**
	 * @description Creates a collection holding a single listener.
	 * @param argsNum How many arguments each listener receives when more than one is registered.
	 * @param task The first listener.
	 */
	constructor(argsNum: number, task: Func) {
		this.argsNum = argsNum;
		this._tasks = task;
		this.length = 1;
		this.call = task;
	}

	push(task: Func) {
		if (this.length > 1) {
			(this._tasks as Func[]).push(task);
		} else {
			this._tasks = this.length === 1 ? [this._tasks as Func, task] : task;
		}

		this.length++;
		this.call = rebuildOnFirstCall;
	}

	insert(index: number, task: Func) {
		if (this.length === 0) {
			this._tasks = [task];
			this.length = 1;
		} else if (this.length === 1) {
			this._tasks = [this._tasks as Func, task];
			this.length = 2;
		} else {
			const tasks = this._tasks as Func[];

			tasks.splice(index, 0, task);
			this.length = tasks.length;
		}

		this.call = rebuildOnFirstCall;
	}

	removeLast(task: Func) {
		if (this.length === 0) return;

		// Matching tseep, a single-listener collection goes silent even when `task` is not that listener.
		if (this.length === 1) {
			if (this._tasks === task) {
				this.length = 0;
			}

			this.call = noop;

			return;
		}

		const tasks = this._tasks as Func[];
		const idx = tasks.lastIndexOf(task);

		if (~idx) {
			tasks.splice(idx, 1);
		}

		if (tasks.length === 1) {
			this._tasks = tasks[0];
			this.length = 1;
		} else {
			this.length = tasks.length;
		}

		this.call = rebuildOnFirstCall;
	}

	growArgsNum(argsNum: number) {
		// Not `>=`: tseep only grows on a true `<`, which differs for non-numeric counts.
		if (!(this.argsNum < argsNum)) return;

		this.argsNum = argsNum;
		this.call = rebuildOnFirstCall;
	}

	rebuild() {
		if (this.length === 0) {
			this.call = noop;
		} else if (this.length === 1) {
			this.call = this._tasks as Func;
		} else {
			this.call = bake(this._tasks as Func[], this.argsNum);
		}
	}

	tasksAsArray(): Func[] {
		if (this.length === 0) {
			return [];
		}

		return this.length === 1 ? [this._tasks as Func] : (this._tasks as Func[]);
	}
}

// Called as `collection.call(...)`, so `this` is the collection. A lone listener called directly
// through `call` therefore sees the collection as `this`, while every other path calls it unbound.
function rebuildOnFirstCall(this: TaskCollection, ...args: unknown[]) {
	this.rebuild();
	Reflect.apply(this.call, void 0, args);
}

// tseep's generated callers pass exactly this many arguments, truncating or padding with undefined.
function fit(args: unknown[], length: number) {
	const fitted = args.slice(0, length);

	fitted.length = length;

	return fitted;
}

// Like the arguments array tseep's `emit` builds when a listener takes more than five parameters.
function tail(args: IArguments, length: number) {
	return fit(Array.prototype.slice.call(args, 1), length);
}

// tseep's eval-baked callers call each listener unbound with exactly `argsNum` arguments. A caller
// per common count does the same without building an argument array, which Hermes pays for per emit.
// Each listener is read into a local first: `fns[i](a)` would call it with the array as `this`.
function bake(tasks: Listener[], argsNum: number): Caller {
	if (tasks.length >= 1500) {
		return bakeLive(tasks as Caller[], argsNum);
	}

	const fns = tasks.slice() as Caller[];
	const len = fns.length;

	switch (argsNum) {
		case 0:
			return () => {
				for (let i = 0; i < len; i++) {
					const fn = fns[i];

					fn();
				}
			};
		case 1:
			return (a) => {
				for (let i = 0; i < len; i++) {
					const fn = fns[i];

					fn(a);
				}
			};
		case 2:
			return (a, b) => {
				for (let i = 0; i < len; i++) {
					const fn = fns[i];

					fn(a, b);
				}
			};
		case 3:
			return (a, b, c) => {
				for (let i = 0; i < len; i++) {
					const fn = fns[i];

					fn(a, b, c);
				}
			};
		case 4:
			return (a, b, c, d) => {
				for (let i = 0; i < len; i++) {
					const fn = fns[i];

					fn(a, b, c, d);
				}
			};
		case 5:
			return (a, b, c, d, e) => {
				for (let i = 0; i < len; i++) {
					const fn = fns[i];

					fn(a, b, c, d, e);
				}
			};
	}

	return (...args) => {
		const fitted = fit(args, argsNum);

		for (let i = 0; i < len; i++) {
			Reflect.apply(fns[i], void 0, fitted);
		}
	};
}

// tseep's caller for 1500+ listeners walks the live array in unrolled steps, calling each listener as
// a method of it, so listeners added or removed mid-emit are seen and a short last step throws.
function bakeLive(tasks: Caller[], argsNum: number): Caller {
	const { length } = tasks;
	const step = length % 10 === 0 ? 10 : length % 4 === 0 ? 4 : length % 3 === 0 ? 3 : 1;

	return (...args) => {
		const fitted = fit(args, argsNum);

		for (let i = 0; i < tasks.length; i += step) {
			for (let j = i; j < i + step; j++) {
				Reflect.apply(tasks[j], tasks, fitted);
			}
		}
	};
}

function warnMax(emitter: EventEmitter, length: number, event: EventName, kind: string) {
	if (emitter.maxListeners !== Infinity && emitter.maxListeners <= length) {
		console.warn(`Maximum event listeners for "${String(event)}" ${kind}event!`);
	}
}

// Fixed parameters as in tseep: listeners of up to five parameters get them without an arguments
// array, and `call` runs as a method, so a lone listener sees the collection as `this`.
// UNKNOWN: listeners receive whatever the emitter was given.
function emit(this: EventEmitter, event: EventName, ...args: unknown[]): boolean;
function emit(
	this: EventEmitter,
	event: EventName,
	a?: unknown,
	b?: unknown,
	c?: unknown,
	d?: unknown,
	e?: unknown,
): boolean {
	const ev = this.events[event] as Fireable | undefined;

	if (!ev || ev.length === 0) {
		return false;
	}

	if (ev.argsNum < 6) {
		ev.call(a, b, c, d, e);
	} else {
		Reflect.apply(ev.call, void 0, tail(arguments, ev.argsNum));
	}

	return true;
}

// UNKNOWN: listeners receive whatever the emitter was given.
function emitHasOnce(this: EventEmitter, event: EventName, ...args: unknown[]): boolean;
function emitHasOnce(
	this: EventEmitter,
	event: EventName,
	a?: unknown,
	b?: unknown,
	c?: unknown,
	d?: unknown,
	e?: unknown,
): boolean {
	const ev = this.events[event] as Fireable | undefined;
	let wide: unknown[] | undefined;

	if (ev !== undefined) {
		if (ev.length === 0) {
			return false;
		}

		if (ev.argsNum < 6) {
			ev.call(a, b, c, d, e);
		} else {
			wide = tail(arguments, ev.argsNum);
			Reflect.apply(ev.call, void 0, wide);
		}
	}

	const oev = this.onceEvents[event] as Caller | Caller[] | undefined;

	if (!oev) {
		return ev !== undefined;
	}

	this.onceEvents[event] = undefined;

	// Matching tseep, short emits call each listener as a method of the detached once array.
	if (arguments.length < 6) {
		if (typeof oev === 'function') {
			oev(a, b, c, d, e);

			return true;
		}

		for (let i = 0; i < oev.length; ++i) {
			oev[i](a, b, c, d, e);
		}

		return true;
	}

	wide ??= tail(arguments, arguments.length - 1);

	if (typeof oev === 'function') {
		Reflect.apply(oev, void 0, wide);

		return true;
	}

	for (let i = 0; i < oev.length; ++i) {
		Reflect.apply(oev[i], void 0, wide);
	}

	return true;
}

function hasOnce(emitter: EventEmitter) {
	return emitter.emit !== emit;
}

function once(this: EventEmitter, event: EventName, listener: Listener) {
	if (this.emit === emit) {
		this.emit = emitHasOnce;
	}

	const current = this.onceEvents[event];

	if (typeof current === 'undefined') {
		this.onceEvents[event] = listener;

		if (typeof event === 'symbol') {
			this._symbolKeys.add(event);
		}
	} else if (typeof current === 'function') {
		this.onceEvents[event] = [current, listener];
	} else if (typeof current === 'object') {
		current.push(listener);
	}

	return this;
}

function addListener(
	this: EventEmitter,
	event: EventName,
	listener: Listener,
	argsNum: number = listener.length,
) {
	if (typeof listener !== 'function') {
		throw new TypeError('The listener must be a function');
	}

	const evtmap = this.events[event];

	if (!evtmap) {
		this.events[event] = new TaskCollection(argsNum, listener);

		if (typeof event === 'symbol') {
			this._symbolKeys.add(event);
		}
	} else {
		evtmap.push(listener);
		evtmap.growArgsNum(argsNum);
		warnMax(this, evtmap.length, event, '');
	}

	return this;
}

function removeListener(this: EventEmitter, event: EventName, listener: Listener) {
	this.events[event]?.removeLast(listener);

	const evto = this.onceEvents[event];

	// Matching tseep, a lone `once` listener is dropped whichever listener was passed.
	if (typeof evto === 'function') {
		this.onceEvents[event] = undefined;
	} else if (evto && typeof evto === 'object') {
		if (evto.length === 1 && evto[0] === listener) {
			this.onceEvents[event] = undefined;
		} else {
			const idx = evto.lastIndexOf(listener);

			if (~idx) {
				evto.splice(idx, 1);
			}
		}
	}

	return this;
}

function addListenerBound(
	this: EventEmitter,
	event: EventName,
	listener: Listener,
	bindTo: unknown = this,
	argsNum: number = listener.length,
) {
	this.boundFuncs ||= new Map();

	const bound = listener.bind(bindTo);

	this.boundFuncs.set(listener, bound);

	return this.addListener(event, bound, argsNum);
}

function removeListenerBound(this: EventEmitter, event: EventName, listener: Listener) {
	const bound = this.boundFuncs?.get(listener);

	this.boundFuncs?.delete(listener);

	return this.removeListener(event, bound as Listener);
}

function hasListeners(this: EventEmitter, event: EventName) {
	return this.events[event] && !!this.events[event].length;
}

function prependListener(
	this: EventEmitter,
	event: EventName,
	listener: Listener,
	argsNum: number = listener.length,
) {
	if (typeof listener !== 'function') {
		throw new TypeError('The listener must be a function');
	}

	const evtmap = this.events[event];

	if (!evtmap || !(evtmap instanceof TaskCollection)) {
		this.events[event] = new TaskCollection(argsNum, listener);

		if (typeof event === 'symbol') {
			this._symbolKeys.add(event);
		}
	} else {
		evtmap.insert(0, listener);
		evtmap.growArgsNum(argsNum);
		warnMax(this, evtmap.length, event, '');
	}

	return this;
}

function prependOnceListener(this: EventEmitter, event: EventName, listener: Listener) {
	if (this.emit === emit) {
		this.emit = emitHasOnce;
	}

	const evtmap = this.onceEvents[event];

	if (!evtmap) {
		this.onceEvents[event] = [listener];
	} else if (typeof evtmap !== 'object') {
		this.onceEvents[event] = [listener, evtmap];
	} else {
		evtmap.unshift(listener);
		warnMax(this, evtmap.length, event, 'once ');

		return this;
	}

	if (typeof event === 'symbol') {
		this._symbolKeys.add(event);
	}

	return this;
}

function removeAllListeners(this: EventEmitter, event?: EventName) {
	if (event === undefined) {
		this.events = Object.create(null);
		this.onceEvents = Object.create(null);
		this._symbolKeys = new Set();
	} else {
		this.events[event] = undefined;
		this.onceEvents[event] = undefined;

		if (typeof event === 'symbol') {
			this._symbolKeys.delete(event);
		}
	}

	return this;
}

function setMaxListeners(this: EventEmitter, n: number) {
	this.maxListeners = n;

	return this;
}

function getMaxListeners(this: EventEmitter) {
	return this.maxListeners;
}

function listeners(this: EventEmitter, event: EventName): Listener[] {
	const ev = this.events[event];

	if (!hasOnce(this)) {
		return ev ? ev.tasksAsArray().slice() : [];
	}

	const oev = this.onceEvents[event];
	const onceList = typeof oev === 'function' ? [oev] : oev;

	// Matching tseep, the once-mode results alias the internal arrays rather than copying them.
	if (!ev) {
		return onceList ?? [];
	}

	return onceList ? [...ev.tasksAsArray(), ...onceList] : ev.tasksAsArray();
}

function eventNames(this: EventEmitter): EventName[] {
	const { events, onceEvents } = this;
	const symbols = [...this._symbolKeys];

	if (!hasOnce(this)) {
		return [...Object.keys(events), ...symbols].filter((x) => x in events && events[x]?.length);
	}

	// `length` of a lone once listener is its arity, so tseep skips zero-arity ones; so does this.
	return [
		...Object.keys(events).filter((x) => events[x]?.length),
		...Object.keys(onceEvents).filter((x) => onceEvents[x]?.length),
		...symbols.filter(
			(x) => (x in events && events[x]?.length) || (x in onceEvents && onceEvents[x]?.length),
		),
	];
}

function listenerCount(this: EventEmitter, type: EventName) {
	const count = this.events[type]?.length || 0;

	return hasOnce(this) ? count + (this.onceEvents[type]?.length || 0) : count;
}

/**
 * @description A typed event emitter with tseep 1.3.1's API and semantics.
 * @template EventMap Maps each event name to its listener signature.
 */
export class EventEmitter<EventMap extends DefaultEventMap = DefaultEventMap> {
	declare events: EventCollections<EventMap>;
	declare onceEvents: OnceCollections<EventMap>;
	declare _symbolKeys: Set<symbol>;
	declare maxListeners: number;
	declare boundFuncs: undefined | Map<Listener, Listener>;

	declare emit: <EventKey extends keyof EventMap>(
		event: EventKey,
		...args: Parameters<EventMap[EventKey]>
	) => boolean;
	declare on: <EventKey extends keyof EventMap = string>(
		event: EventKey,
		listener: EventMap[EventKey],
	) => this;
	declare once: <EventKey extends keyof EventMap = string>(
		event: EventKey,
		listener: EventMap[EventKey],
	) => this;
	declare addListener: <EventKey extends keyof EventMap = string>(
		event: EventKey,
		listener: EventMap[EventKey],
		argsNum?: ArgsNum<EventMap[EventKey]>,
	) => this;
	declare removeListener: <EventKey extends keyof EventMap = string>(
		event: EventKey,
		listener: EventMap[EventKey],
	) => this;
	declare hasListeners: <EventKey extends keyof EventMap = string>(event: EventKey) => boolean;
	declare prependListener: <EventKey extends keyof EventMap = string>(
		event: EventKey,
		listener: EventMap[EventKey],
	) => this;
	declare prependOnceListener: <EventKey extends keyof EventMap = string>(
		event: EventKey,
		listener: EventMap[EventKey],
	) => this;
	declare off: <EventKey extends keyof EventMap = string>(
		event: EventKey,
		listener: EventMap[EventKey],
	) => this;
	declare removeAllListeners: <EventKey extends keyof EventMap = string>(
		event?: EventKey,
	) => this;
	declare setMaxListeners: (n: number) => this;
	declare getMaxListeners: () => number;
	declare listeners: <EventKey extends keyof EventMap = string>(
		event: EventKey,
	) => EventMap[EventKey][];
	declare rawListeners: <EventKey extends keyof EventMap = string>(
		event: EventKey,
	) => EventMap[EventKey][];
	declare eventNames: () => Array<string | symbol>;
	declare listenerCount: <EventKey extends keyof EventMap = string>(type: EventKey) => number;
	declare addListenerBound: <EventKey extends keyof EventMap = string>(
		event: EventKey,
		listener: EventMap[EventKey],
		// UNKNOWN: any value can be a listener's `this`.
		bindTo?: unknown,
		argsNum?: ArgsNum<EventMap[EventKey]>,
	) => this;
	declare removeListenerBound: <EventKey extends keyof EventMap = string>(
		event: EventKey,
		listener: EventMap[EventKey],
	) => this;

	/**
	 * @description Creates an emitter with no listeners.
	 */
	constructor() {
		this.events = Object.create(null);
		this.onceEvents = Object.create(null);
		this._symbolKeys = new Set();
		this.maxListeners = Infinity;
	}

	get _eventsCount(): number {
		return this.eventNames().length;
	}
}

// Assigned rather than declared as methods so they stay enumerable and `on`/`off` share identity
// with `addListener`/`removeListener`, as in tseep. `rawListeners` is typed but never implemented.
Object.assign(EventEmitter.prototype, {
	emit,
	on: addListener,
	once,
	addListener,
	removeListener,
	addListenerBound,
	removeListenerBound,
	hasListeners,
	prependListener,
	prependOnceListener,
	off: removeListener,
	removeAllListeners,
	setMaxListeners,
	getMaxListeners,
	listeners,
	eventNames,
	listenerCount,
});

export default EventEmitter;
