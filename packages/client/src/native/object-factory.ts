import type {
	NativeCallOptions,
	NativeClassHandle,
	NativeObjCBridge,
	NativeObjectHandle,
} from '@unbound-app/types';

type ClassReference = string | NativeClassHandle;

type AllocBridge = Pick<NativeObjCBridge, 'alloc' | 'call' | 'className' | 'getClass' | 'invoke'>;

const MAIN_THREAD_ROOT_CLASS = 'UIResponder';

export type ObjectFactory = {
	alloc: (classOrName: ClassReference) => NativeObjectHandle;
	create: (
		classOrName: ClassReference,
		initSelector: string,
		args?: unknown[],
		options?: NativeCallOptions,
	) => NativeObjectHandle;
};

function isObjectHandle(value: unknown): value is NativeObjectHandle {
	return typeof value === 'object' && value !== null;
}

/**
 * @description Creates the factory behind `objc.alloc` and `objc.create`, which builds UIKit objects on the main thread and everything else on the calling thread.
 * @param bridge The Objective-C bridge.
 * @returns `alloc`, which returns an instance initialized with `init` and falls back to the calling thread when the main thread cannot be reached, and `create`, which allocates an uninitialized instance and sends it only the given init selector.
 */
export function createObjectFactory(bridge: AllocBridge): ObjectFactory {
	const needsMainThread = new Map<string, boolean>();
	let rootClass: NativeClassHandle | null | undefined;

	function resolveClass(classOrName: ClassReference): NativeClassHandle | null {
		return typeof classOrName === 'string' ? bridge.getClass(classOrName) : classOrName;
	}

	function isMainThreadClass(cls: NativeClassHandle): boolean {
		const name = bridge.className(cls);
		const known = name ? needsMainThread.get(name) : undefined;

		if (known !== undefined) {
			return known;
		}

		rootClass ??= bridge.getClass(MAIN_THREAD_ROOT_CLASS);

		const result = !!rootClass && !!bridge.call(cls, 'isSubclassOfClass:', rootClass);

		if (name) {
			needsMainThread.set(name, result);
		}

		return result;
	}

	function alloc(classOrName: ClassReference): NativeObjectHandle {
		const cls = resolveClass(classOrName);

		if (!cls || !isMainThreadClass(cls)) {
			return bridge.alloc(classOrName);
		}

		try {
			const instance = bridge.invoke(cls, 'new', [], { thread: 'main' });

			if (instance) {
				return instance as NativeObjectHandle;
			}
		} catch {
			return bridge.alloc(classOrName);
		}

		return bridge.alloc(classOrName);
	}

	function create(
		classOrName: ClassReference,
		initSelector: string,
		args: unknown[] = [],
		options?: NativeCallOptions,
	): NativeObjectHandle {
		const cls = resolveClass(classOrName);

		if (!cls) {
			throw new Error(
				`Objective-C class ${typeof classOrName === 'string' ? classOrName : 'handle'} is not available.`,
			);
		}

		const thread = options?.thread ?? (isMainThreadClass(cls) ? 'main' : 'current');
		const instance = bridge.invoke(cls, 'alloc', [], { thread });

		if (!isObjectHandle(instance)) {
			throw new Error(`Allocating ${bridge.className(cls) ?? 'the class'} returned nil.`);
		}

		const initialized = bridge.invoke(instance, initSelector, args, { ...options, thread });

		if (!isObjectHandle(initialized)) {
			throw new Error(`${initSelector} returned nil.`);
		}

		return initialized;
	}

	return { alloc, create };
}
