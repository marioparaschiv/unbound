/**
 * @description Names a plugin's evaluated source the way its compiled bytecode names it, so stack frames show the plugin.
 * @param id The plugin's id.
 * @returns The source name, such as `unbound-plugin/example.js`.
 */
export function pluginSourceName(id: string): string {
	return `unbound-plugin/${id.replace(/\s/g, '')}.js`;
}
