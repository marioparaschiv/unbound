import type { NativeClassHandle, NativeObjCBridge, NativeObjectHandle } from '@unbound-app/types';

type ClassReference = string | NativeClassHandle;

type AllocBridge = Pick<NativeObjCBridge, 'alloc' | 'call' | 'className' | 'getClass' | 'invoke'>;

const MAIN_THREAD_ROOT_CLASS = 'UIResponder';

/**
 * @description Creates an allocator that builds UIKit objects on the main thread and everything else on the calling thread.
 * @param bridge The Objective-C bridge.
 * @returns The allocator, which falls back to the calling thread when the main thread cannot be reached.
 */
export function createMainThreadAlloc(
	bridge: AllocBridge,
): (classOrName: ClassReference) => NativeObjectHandle {
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

	return (classOrName) => {
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
	};
}
