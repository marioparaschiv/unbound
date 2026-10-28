/** What `/debug` reports about the running client. Every field is already a display string. */
export type DebugInfo = {
	client: string;
	loader: string;
	discord: string;
	discordBuild: string;
	react: string;
	reactNative: string;
	hermes: string;
	bytecode: string;
	system: string;
	device: string;
};

/**
 * @description Formats the client's debug information as a quoted Discord message, one line per component.
 * @param info The versions and device details.
 * @returns The message text.
 */
export function formatDebugInfo(info: DebugInfo): string {
	return [
		'**Unbound Debug Info**',
		`> Unbound: ${info.client} (Loader ${info.loader})`,
		`> Discord: ${info.discord} (${info.discordBuild})`,
		`> React: ${info.react} (RN ${info.reactNative})`,
		`> Hermes: ${info.hermes} (bcv${info.bytecode})`,
		`> System: ${info.system}`,
		`> Device: ${info.device}`,
	].join('\n');
}

export default formatDebugInfo;
