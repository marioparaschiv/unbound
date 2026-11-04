import type {
	NativeAssociationKey,
	NativeBatchReference,
	NativeClassHandle,
	NativeHandle,
	NativeHookContext,
	NativeHookHandlers,
	NativeHookOptions,
	NativeHookToken,
	NativeObjCBridge,
	NativeObjCCallPlan,
	NativeObjectHandle,
	NativeStruct,
} from '../src/native';

import {
	brand,
	createCallLog,
	settled,
	withMissingMembers,
	type NativeCall,
	type NativeCallLog,
} from './fake-native-bridge';

/** What an Objective-C call returns: a plain value, a handle, a 64-bit integer, or nothing. */
type ObjcResult = ReturnType<NativeObjCBridge['call']>;

/** A method a test registers on a class: it receives the object (or the class, for a class method) and the call's arguments. */
// UNKNOWN: a registered method takes whatever arguments the plugin under test passes.
export type ObjcMethod = (self: NativeObjectHandle, ...args: unknown[]) => ObjcResult;

/** What a test registers for an Objective-C class. */
export type ObjcClassSpec = {
	/** The class whose methods this one inherits, and `callSuper` reaches. */
	superclass?: string;
	/** Instance methods by selector, such as `setAlpha:`. */
	methods?: Record<string, ObjcMethod>;
	/** Class methods by selector, such as `sharedApplication`. */
	classMethods?: Record<string, ObjcMethod>;
};

/** The fake Objective-C bridge a plugin calls, and what a test uses to fill it. */
export type FakeObjc = {
	/** The `objc` a plugin's `context.native` holds. */
	bridge: NativeObjCBridge;
	/** Adds a class a plugin can find with `objc.getClass`, or replaces it. */
	registerClass: (name: string, spec?: ObjcClassSpec) => void;
	/** Makes an object of a registered class, with instance variables a plugin reads through `getIvar`. */
	create: (className: string, ivars?: Record<string, ObjcResult>) => NativeObjectHandle;
	/** Forgets every class, object and hook. */
	reset: () => void;
};

type Hook = {
	className: string;
	selector: string;
	handlers: NativeHookHandlers;
	options: NativeHookOptions;
	token: NativeHookToken & { active: boolean };
};

// A handle is an opaque brand on device; here it is a real object the fake reads its class and variables from.
class ObjcHandle {
	readonly className: string;
	readonly isClass: boolean;
	readonly ivars = new Map<string, ObjcResult>();
	readonly associated = new Map<NativeAssociationKey, ObjcResult>();
	selector = '';

	constructor(className: string, isClass: boolean) {
		this.className = className;
		this.isClass = isClass;
	}
}

// A struct is an opaque brand on device; the fake keeps its name and fields.
class ObjcStruct<T extends object> {
	readonly name: string;
	readonly value: T;

	constructor(name: string, value: T) {
		this.name = name;
		this.value = value;
	}
}

// UNKNOWN: any value may be passed where a handle is expected, and only an object the fake made is one.
function handleOf(value: unknown): ObjcHandle | undefined {
	return value instanceof ObjcHandle ? value : undefined;
}

// UNKNOWN: a batch step's target or argument is any value, or a reference to an earlier step's result.
function isBatchReference(value: unknown): value is NativeBatchReference {
	return typeof value === 'object' && value !== null && '$nativeBatchResult' in value;
}

/**
 * @description Creates the fake `objc`: classes and methods a test registers answer `invoke`, `call`, `create` and the rest,
 * `hook` runs its handlers around a registered method, and every call is recorded in the log.
 * @param log Where each call is recorded.
 * @returns The bridge and what fills it.
 */
export function createFakeObjc(log: NativeCallLog = createCallLog()): FakeObjc {
	const classes = new Map<string, ObjcClassSpec>();
	const hooks = new Set<Hook>();

	function chain(className: string): string[] {
		const names: string[] = [];

		for (
			let name: string | undefined = className;
			name !== undefined && !names.includes(name);
			name = classes.get(name)?.superclass
		) {
			names.push(name);
		}

		return names;
	}

	function methodOf(className: string, selector: string, isClass: boolean, after?: string) {
		const names = chain(className);

		for (const name of names.slice(after === undefined ? 0 : names.indexOf(after) + 1)) {
			const spec = classes.get(name);
			const found = isClass ? spec?.classMethods?.[selector] : spec?.methods?.[selector];

			if (found) {
				return found;
			}
		}
	}

	function reference(handle: NativeHandle, call: string): ObjcHandle {
		const found = handleOf(handle);

		if (!found) {
			throw new TypeError(
				`Failed to call objc.${call}: the target is not an Objective-C handle.`,
			);
		}

		return found;
	}

	function create(className: string, ivars: Record<string, ObjcResult> = {}): NativeObjectHandle {
		const instance = new ObjcHandle(className, false);

		for (const [name, value] of Object.entries(ivars)) instance.ivars.set(name, value);

		return brand<NativeObjectHandle>(instance);
	}

	function className(handle: NativeHandle): string | null {
		return handleOf(handle)?.className ?? null;
	}

	function classNameOf(name: string | NativeClassHandle): string {
		return typeof name === 'string' ? name : (className(name) ?? 'unknown');
	}

	// The calls every class answers: `alloc` and `new` make an object, an `init…` returns the receiver.
	function builtIn(target: ObjcHandle, selector: string): ObjcMethod | undefined {
		if (target.isClass && (selector === 'alloc' || selector === 'new')) {
			return () => create(target.className);
		}

		if (!target.isClass && selector.startsWith('init')) {
			return (self) => self;
		}
	}

	// UNKNOWN: the arguments and result are whatever the plugin and the test's fake method agree on.
	function runHooks(
		target: ObjcHandle,
		selector: string,
		args: NativeCall['args'],
		original: NativeHookContext['original'],
	): ObjcResult {
		const self = brand<NativeObjectHandle>(target);
		const active = [...hooks].filter(
			(hook) =>
				hook.selector === selector &&
				chain(target.className).includes(hook.className) &&
				(hook.options.instance === undefined || hook.options.instance === self),
		);

		function context(phase: NativeHookContext['phase']): NativeHookContext {
			return {
				self,
				selector,
				args,
				argumentIndexes: args.map((_, index) => index),
				phase,
				original,
				replaceObjectArgument: (index, value) => void (args[index] = value),
			};
		}

		for (const hook of active) hook.handlers.before?.(context('before'));

		const replacing = active.find((hook) => hook.handlers.replace);
		const result = replacing?.handlers.replace?.(context('replace')) ?? original();

		for (const hook of active) hook.handlers.after?.(context('after'));

		for (const hook of active) {
			if (hook.options.once) {
				hook.token.remove();
			}
		}

		return result;
	}

	// UNKNOWN: the arguments and result are whatever the plugin and the test's fake method agree on.
	function send(
		handle: NativeHandle,
		selector: string,
		args: NativeCall['args'],
		call: string,
		after?: string,
	): ObjcResult {
		const target = reference(handle, call);

		log.record({
			bridge: 'objc',
			method: call,
			target: target.className,
			name: selector,
			args,
		});

		const method =
			methodOf(target.className, selector, target.isClass, after) ??
			builtIn(target, selector);

		if (!method) {
			throw new Error(
				`Failed to call ${target.className} ${selector}: the test registered no such method. Add it with native.objc.registerClass('${target.className}', { ${target.isClass ? 'classMethods' : 'methods'}: { '${selector}': () => … } }).`,
			);
		}

		const self = brand<NativeObjectHandle>(target);

		return runHooks(target, selector, args, (...next) =>
			method(self, ...(next.length ? next : args)),
		);
	}

	// UNKNOWN: the arguments and result are whatever the plugin and the test's fake method agree on.
	function invokePrepared(plan: NativeHandle, handle: NativeHandle, args: NativeCall['args']) {
		return send(handle, reference(plan, 'invokePrepared').selector, args, 'invokePrepared');
	}

	function respondsTo(handle: NativeHandle, selector: string): boolean {
		const target = handleOf(handle);

		return Boolean(
			target &&
			(methodOf(target.className, selector, target.isClass) || builtIn(target, selector)),
		);
	}

	// UNKNOWN: a batch step's target or argument is any value, or a reference to an earlier step's result.
	function resolveStep(step: unknown, results: ObjcResult[]) {
		return isBatchReference(step) ? results[step.$nativeBatchResult] : step;
	}

	const bridge: NativeObjCBridge = withMissingMembers<NativeObjCBridge>('objc', {
		getClass(name) {
			log.record({ bridge: 'objc', method: 'getClass', target: name, name: '', args: [] });

			return classes.has(name) ? brand<NativeClassHandle>(new ObjcHandle(name, true)) : null;
		},
		className,
		alloc(classOrName) {
			const name = classNameOf(classOrName);

			log.record({ bridge: 'objc', method: 'alloc', target: name, name: 'alloc', args: [] });

			if (!classes.has(name)) {
				throw new Error(`Objective-C class ${name} is not available.`);
			}

			return create(name);
		},
		create(classOrName, initSelector, args = []) {
			const name = classNameOf(classOrName);

			if (!classes.has(name)) {
				throw new Error(`Objective-C class ${name} is not available.`);
			}

			const instance = create(name);
			const initialized = send(instance, initSelector, args, 'create');

			const returned = handleOf(initialized);

			return returned ? brand<NativeObjectHandle>(returned) : instance;
		},
		respondsTo,
		call: (handle, selector, ...args) => send(handle, selector, args, 'call'),
		callSuper: (handle, currentClass, selector, ...args) =>
			send(handle, selector, args, 'callSuper', classNameOf(currentClass)),
		invoke: (handle, selector, args) => send(handle, selector, args, 'invoke'),
		invokeAsync: (handle, selector, args) =>
			settled(() => send(handle, selector, args, 'invokeAsync')),
		invokeSuper: (handle, currentClass, selector, args) =>
			send(handle, selector, args, 'invokeSuper', classNameOf(currentClass)),
		invokeSuperAsync: (handle, currentClass, selector, args) =>
			settled(() =>
				send(handle, selector, args, 'invokeSuperAsync', classNameOf(currentClass)),
			),
		prepare(handle, selector) {
			const plan = new ObjcHandle('plan', false);

			plan.selector = selector;

			return brand<NativeObjCCallPlan>(plan);
		},
		invokePrepared,
		invokePreparedAsync: (plan, handle, args) =>
			settled(() => invokePrepared(plan, handle, args)),
		disposePlan: () => {},
		batch: (steps) =>
			settled(() => {
				const results: ObjcResult[] = [];

				for (const step of steps) {
					const target = resolveStep(step.target, results);
					const args = step.args.map((arg) => resolveStep(arg, results));

					results.push(send(brand(Object(target)), step.selector, args, 'batch'));
				}

				return results;
			}),
		getIvar: (handle, name) => reference(handle, 'getIvar').ivars.get(name),
		setIvar: (handle, name, value) => void reference(handle, 'setIvar').ivars.set(name, value),
		createAssociationKey: () => brand<NativeAssociationKey>(new ObjcHandle('key', false)),
		getAssociatedObject: (handle, key) =>
			reference(handle, 'getAssociatedObject').associated.get(key),
		setAssociatedObject: (handle, key, value) =>
			void reference(handle, 'setAssociatedObject').associated.set(key, value),
		struct: (name, fields) => brand<NativeStruct<typeof fields>>(new ObjcStruct(name, fields)),
		hook(hookClass, selector, handlers, options = {}) {
			const token = {
				active: true,
				setReturnValue: () => {},
				removeReturnValue: () => {},
				clearReturnValues: () => {},
				remove() {
					token.active = false;
					hooks.delete(hook);
				},
			};
			const hook: Hook = {
				className: hookClass,
				selector,
				handlers: handlers as NativeHookHandlers,
				options,
				token,
			};

			hooks.add(hook);
			log.record({
				bridge: 'objc',
				method: 'hook',
				target: hookClass,
				name: selector,
				args: [],
			});

			return token;
		},
	});

	return {
		bridge,
		registerClass: (name, spec = {}) => void classes.set(name, spec),
		create,
		reset() {
			classes.clear();
			hooks.clear();
		},
	};
}
