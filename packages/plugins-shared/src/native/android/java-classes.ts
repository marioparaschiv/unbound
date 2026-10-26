import type { NativeJavaBridge, NativeJavaClassDescription } from '@unbound-app/api/native';

const descriptions = new WeakMap<NativeJavaBridge, Map<string, NativeJavaClassDescription>>();

/**
 * @description Describes a Java class once and reuses the description, since a class does not change while Discord runs.
 * @param java The Java bridge.
 * @param name The class name.
 * @returns The class's declared constructors, methods and fields.
 */
export function describeJavaClass(
	java: NativeJavaBridge,
	name: string,
): NativeJavaClassDescription {
	const known = descriptions.get(java) ?? new Map<string, NativeJavaClassDescription>();
	const cached = known.get(name);

	if (cached) {
		return cached;
	}

	const description = java.describe(name);

	known.set(name, description);
	descriptions.set(java, known);

	return description;
}
