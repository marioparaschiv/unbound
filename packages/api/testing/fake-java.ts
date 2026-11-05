import type {
	NativeJavaArgument,
	NativeJavaAssociationKey,
	NativeJavaBatchOperation,
	NativeJavaBridge,
	NativeJavaCallPlan,
	NativeJavaHandle,
	NativeJavaHookEvent,
	NativeJavaHookOptions,
	NativeJavaHooksBridge,
	NativeJavaReference,
	NativeJavaValue,
} from '../src/native';

import {
	brand,
	createCallLog,
	settled,
	withMissingMembers,
	type NativeCallLog,
} from './fake-native-bridge';

/** A value a test's Java method takes or returns: a tagged value or handle as the bridge has it, or a plain string, number, boolean, `null` or list. */
export type JavaPlain =
	| string
	| number
	| boolean
	| null
	| undefined
	| NativeJavaValue
	| NativeJavaHandle
	| JavaPlain[];

/** A method a test registers on a Java class: it receives the object and the call's plain arguments, and returns a plain value. */
export type JavaMethod = (self: NativeJavaHandle, ...args: JavaPlain[]) => JavaPlain;

/** The types a method declares, as `java.describe` lists them. A type is a class name such as `java.lang.String`, or `int`. */
export type JavaSignature = {
	/** The parameters' class names, in order; none when omitted. */
	parameters?: string[];
	/** The return type's class name; `java.lang.Object` when omitted. */
	returnType?: string;
};

/** What a test registers for a Java class. */
export type JavaClassSpec = {
	/** The fully qualified name of the class whose members this one inherits. */
	superclass?: string;
	/** Instance methods by name, such as `getWidth`. */
	methods?: Record<string, JavaMethod>;
	/** Static methods by name, such as `parse`; `self` is the class. */
	staticMethods?: Record<string, JavaMethod>;
	/** The instance fields a new object starts with. */
	fields?: Record<string, JavaPlain>;
	/** The static fields, such as `INSTANCE`. */
	staticFields?: Record<string, JavaPlain>;
	/** The types of the methods and static methods, by name, that `java.describe` returns. */
	signatures?: Record<string, JavaSignature>;
	/** The types of the fields and static fields, by name, that `java.describe` returns; `java.lang.Object` when omitted. */
	fieldTypes?: Record<string, string>;
	/** Runs when `java.construct` makes an object, with the constructor's plain arguments. */
	construct?: (self: NativeJavaHandle, ...args: JavaPlain[]) => void;
};

/** The fake Java bridge a plugin calls, its hooks bridge, and what a test uses to fill them. */
export type FakeJava = {
	/** The `java` a plugin's `context.native` holds. */
	bridge: NativeJavaBridge;
	/** The `hooks` a plugin's `context.native` holds. */
	hooks: NativeJavaHooksBridge;
	/** Adds a class a plugin can find with `java.getClass`, or replaces it. */
	registerClass: (name: string, spec?: JavaClassSpec) => void;
	/** Makes an object of a registered class, with its fields, as the plugin sees it: a tagged `handle` value. */
	create: (className: string, fields?: Record<string, JavaPlain>) => NativeJavaValue;
	/** Forgets every class, object and hook. */
	reset: () => void;
};

type HookEntry = {
	className: string;
	methodName: string;
	options: NativeJavaHookOptions;
	listener?: (event: NativeJavaHookEvent) => void;
	results: Map<string, NativeJavaValue>;
};

// A handle is an opaque brand on device; here it is a real object the fake reads its class and fields from.
class JavaObject {
	readonly id: string;
	readonly className: string;
	readonly isClass: boolean;
	readonly fields = new Map<string, JavaPlain>();
	readonly associated = new Map<NativeJavaAssociationKey, JavaPlain>();

	constructor(id: string, className: string, isClass: boolean) {
		this.id = id;
		this.className = className;
		this.isClass = isClass;
	}
}

const TAGGED = new Set([
	'null',
	'handle',
	'string',
	'boolean',
	'byte',
	'short',
	'int',
	'long',
	'float',
	'double',
	'char',
	'array',
]);

function isTagged(value: JavaPlain): value is NativeJavaValue {
	return (
		typeof value === 'object' &&
		value !== null &&
		!Array.isArray(value) &&
		'type' in value &&
		typeof value.type === 'string' &&
		TAGGED.has(value.type)
	);
}

function tagKey(value: NativeJavaValue): string {
	return JSON.stringify(value);
}

/**
 * @description Creates the fake `java` and `hooks`: classes and methods a test registers answer `invoke`, `construct`,
 * `getField` and the rest with tagged values as the bridge returns them, and every call is recorded in the log.
 * @param log Where each call is recorded.
 * @returns The bridges and what fills them.
 */
export function createFakeJava(log: NativeCallLog = createCallLog()): FakeJava {
	const classes = new Map<string, JavaClassSpec>();
	const objects = new Map<string, JavaObject>();
	const hookEntries = new Map<string, HookEntry>();
	let next = 0;

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

	function spawn(className: string, isClass: boolean): JavaObject {
		const object = new JavaObject(`java-${++next}`, className, isClass);

		objects.set(object.id, object);

		return object;
	}

	function instance(className: string, fields: Record<string, JavaPlain> = {}): JavaObject {
		const object = spawn(className, false);

		for (const name of chain(className).toReversed()) {
			for (const [field, value] of Object.entries(classes.get(name)?.fields ?? {})) {
				object.fields.set(field, value);
			}
		}

		for (const [field, value] of Object.entries(fields)) object.fields.set(field, value);

		return object;
	}

	function resolve(reference: NativeJavaReference | JavaObject, call: string): JavaObject {
		const found =
			reference instanceof JavaObject
				? reference
				: typeof reference === 'object' && reference !== null && 'value' in reference
					? objects.get(String(reference.value))
					: undefined;

		if (!found) {
			throw new TypeError(`Failed to call java.${call}: the target is not a Java handle.`);
		}

		return found;
	}

	// A plain value a test's method gets for a tagged argument.
	function plain(value: JavaPlain): JavaPlain {
		if (value instanceof JavaObject || !isTagged(value)) {
			return value;
		}

		switch (value.type) {
			case 'null':
				return null;
			case 'handle':
				return brand<NativeJavaHandle>(objects.get(value.value) ?? {});
			case 'array':
				return value.value.map(plain);
			default:
				return value.value;
		}
	}

	// The tagged value the bridge returns for what a test's method returned.
	function tagged(value: JavaPlain): NativeJavaValue {
		if (value === null || value === undefined) {
			return { type: 'null' };
		}

		if (typeof value === 'string') {
			return { type: 'string', value };
		}

		if (typeof value === 'boolean') {
			return { type: 'boolean', value };
		}

		if (typeof value === 'number') {
			return { type: Number.isInteger(value) ? 'int' : 'double', value };
		}

		if (Array.isArray(value)) {
			return { type: 'array', componentType: 'java.lang.Object', value: value.map(tagged) };
		}

		if (value instanceof JavaObject) {
			return { type: 'handle', value: value.id };
		}

		return isTagged(value) ? value : { type: 'null' };
	}

	function memberOf(
		className: string,
		name: string,
		kind: 'methods' | 'staticMethods',
	): JavaMethod | undefined {
		for (const each of chain(className)) {
			const found = classes.get(each)?.[kind]?.[name];

			if (found) {
				return found;
			}
		}
	}

	function notify(
		target: JavaObject,
		name: string,
		args: JavaPlain[],
		phase: 'before' | 'after',
	) {
		for (const entry of hookEntries.values()) {
			const notifies =
				entry.methodName === name &&
				chain(target.className).includes(entry.className) &&
				entry.options.notify !== false &&
				(entry.options.notify === 'after') === (phase === 'after');

			if (!notifies) {
				continue;
			}

			entry.listener?.({
				self: tagged(brand<NativeJavaHandle>(target)),
				args: args.map(tagged),
				argumentIndexes: args.map((_, index) => index),
				phase,
			});
		}
	}

	function invoke(reference: NativeJavaReference, name: string, args: NativeJavaArgument[] = []) {
		const target = resolve(reference, 'invoke');

		log.record({ bridge: 'java', method: 'invoke', target: target.className, name, args });

		const method = memberOf(
			target.className,
			name,
			target.isClass ? 'staticMethods' : 'methods',
		);

		if (!method) {
			throw new Error(
				`Failed to call ${target.className}.${name}: the test registered no such method. Add it with native.java.registerClass('${target.className}', { ${target.isClass ? 'staticMethods' : 'methods'}: { ${name}: () => … } }).`,
			);
		}

		const plainArgs = args.map(plain);

		notify(target, name, plainArgs, 'before');

		const replaced = [...hookEntries.values()]
			.filter((entry) => entry.options.replace && entry.methodName === name)
			.map((entry) => entry.results.get(tagKey(tagged(brand<NativeJavaHandle>(target)))))
			.find(Boolean);
		const result = replaced ?? tagged(method(brand<NativeJavaHandle>(target), ...plainArgs));

		notify(target, name, plainArgs, 'after');

		return result;
	}

	function getField(reference: NativeJavaReference, name: string): NativeJavaValue {
		const target = resolve(reference, 'getField');

		log.record({
			bridge: 'java',
			method: 'getField',
			target: target.className,
			name,
			args: [],
		});

		if (target.isClass) {
			for (const each of chain(target.className)) {
				const fields = classes.get(each)?.staticFields;

				if (fields && name in fields) {
					return tagged(fields[name]);
				}
			}
		} else if (target.fields.has(name)) {
			return tagged(target.fields.get(name));
		}

		throw new Error(
			`Failed to read ${target.className}.${name}: the test registered no such field. Add it with native.java.registerClass('${target.className}', { ${target.isClass ? 'staticFields' : 'fields'}: { ${name}: … } }).`,
		);
	}

	function setField(reference: NativeJavaReference, name: string, value: NativeJavaArgument) {
		const target = resolve(reference, 'setField');

		log.record({
			bridge: 'java',
			method: 'setField',
			target: target.className,
			name,
			args: [value],
		});
		target.fields.set(name, plain(value));
	}

	function respondsTo(reference: NativeJavaReference, name: string): NativeJavaValue {
		const target = resolve(reference, 'respondsTo');

		return {
			type: 'boolean',
			value: Boolean(
				memberOf(target.className, name, target.isClass ? 'staticMethods' : 'methods'),
			),
		};
	}

	function operate(operation: NativeJavaBatchOperation): NativeJavaValue {
		switch (operation.op) {
			case 'invoke':
				return invoke(operation.handle, operation.name, operation.args);
			case 'getField':
				return getField(operation.handle, operation.name);
			case 'respondsTo':
				return respondsTo(operation.handle, operation.name);
			case 'setField':
				setField(operation.handle, operation.name, operation.value ?? { type: 'null' });

				return { type: 'null' };
		}
	}

	const bridge = withMissingMembers<NativeJavaBridge>('java', {
		getClass(name) {
			log.record({ bridge: 'java', method: 'getClass', target: name, name: '', args: [] });

			if (!classes.has(name)) {
				throw new Error(`Failed to find Java class ${name}: the test registered none.`);
			}

			return brand<NativeJavaHandle>(spawn(name, true));
		},
		describe(name) {
			const spec = classes.get(name);

			if (!spec) {
				throw new Error(`Failed to describe Java class ${name}: the test registered none.`);
			}

			const describeMethod = (method: string, isStatic: boolean) => ({
				name: method,
				parameters: spec.signatures?.[method]?.parameters ?? [],
				returnType: spec.signatures?.[method]?.returnType ?? 'java.lang.Object',
				static: isStatic,
			});
			const describeField = (field: string, isStatic: boolean) => ({
				name: field,
				type: spec.fieldTypes?.[field] ?? 'java.lang.Object',
				static: isStatic,
			});

			return {
				name,
				superclass: spec.superclass ?? null,
				interfaces: [],
				constructors: [[]],
				methods: [
					...Object.keys(spec.methods ?? {}).map((method) =>
						describeMethod(method, false),
					),
					...Object.keys(spec.staticMethods ?? {}).map((method) =>
						describeMethod(method, true),
					),
				],
				fields: [
					...Object.keys(spec.fields ?? {}).map((field) => describeField(field, false)),
					...Object.keys(spec.staticFields ?? {}).map((field) =>
						describeField(field, true),
					),
				],
			};
		},
		construct(name, args = []) {
			log.record({ bridge: 'java', method: 'construct', target: name, name: '<init>', args });

			if (!classes.has(name)) {
				throw new Error(`Failed to find Java class ${name}: the test registered none.`);
			}

			const object = instance(name);
			const handle = brand<NativeJavaHandle>(object);

			for (const each of chain(name).toReversed()) {
				classes.get(each)?.construct?.(handle, ...args.map(plain));
			}

			return handle;
		},
		className: (reference) => ({
			type: 'string',
			value: resolve(reference, 'className').className,
		}),
		respondsTo: (reference, name) => respondsTo(reference, name),
		invoke,
		invokeAsync: (reference, name, args) => settled(() => invoke(reference, name, args)),
		getField,
		setField,
		batch: (operations) => operations.map(operate),
		batchAsync: (operations) => settled(() => operations.map(operate)),
		prepare: (target, name) =>
			brand<NativeJavaCallPlan>(Object.assign(spawn('plan', false), { name })),
		invokePrepared: (plan, target, args) =>
			invoke(target, String(Reflect.get(plan, 'name')), args),
		invokePreparedAsync: (plan, target, args) =>
			settled(() => invoke(target, String(Reflect.get(plan, 'name')), args)),
		disposePlan: () => {},
		createAssociationKey: () => brand<NativeJavaAssociationKey>(spawn('key', false)),
		getAssociatedObject: (reference, key) =>
			tagged(resolve(reference, 'getAssociatedObject').associated.get(key)),
		setAssociatedObject: (reference, key, value) =>
			void resolve(reference, 'setAssociatedObject').associated.set(key, plain(value)),
		release: () => {},
	});

	const hooks = withMissingMembers<NativeJavaHooksBridge>('hooks', {
		hook(className, methodName, _parameterTypes, options = {}, listener) {
			const id = `hook-${++next}`;

			log.record({
				bridge: 'hooks',
				method: 'hook',
				target: className,
				name: methodName,
				args: [],
			});
			hookEntries.set(id, {
				className,
				methodName,
				options,
				listener: listener as HookEntry['listener'],
				results: new Map(),
			});

			return { id };
		},
		setReturnValue: (token, self, _args, value) =>
			void hookEntries.get(token.id)?.results.set(tagKey(self), value),
		removeReturnValue: (token, self) =>
			void hookEntries.get(token.id)?.results.delete(tagKey(self)),
		clearReturnValues: (token) => hookEntries.get(token.id)?.results.clear(),
		remove: (token) => void hookEntries.delete(token.id),
	});

	return {
		bridge,
		hooks,
		registerClass: (name, spec = {}) => void classes.set(name, spec),
		create: (className, fields) => tagged(brand<NativeJavaHandle>(instance(className, fields))),
		reset() {
			classes.clear();
			objects.clear();
			hookEntries.clear();
		},
	};
}
