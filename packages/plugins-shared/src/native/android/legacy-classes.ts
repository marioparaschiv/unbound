/**
 * @description Marks a Java class name that only older Discord builds have, for code that finds its replacement structurally on newer ones. The compat scan reports a marked name as covered instead of broken.
 * @param name The class name.
 * @returns The same name.
 */
export function legacyJavaClass(name: string): string {
	return name;
}
