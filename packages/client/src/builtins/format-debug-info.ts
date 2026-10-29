/** What `/debug` reports about the running client. Every field is already a display string. */
export type DebugInfo = {
	client: string;
	loader: string;
	loaderOrigin: string;
	discord: string;
	discordBuild: string;
	appSource: string;
	react: string;
	reactNative: string;
	hermes: string;
	bytecode: string;
	platform: string;
	os: string;
	device: string;
	flags: string[];
};

/**
 * @description Formats the client's debug information as a quoted Discord message, one line per component.
 * @param info The versions and device details.
 * @returns The message text.
 */
export function formatDebugInfo(info: DebugInfo): string {
	const flags = info.flags.length ? ` (${info.flags.join(', ')})` : '';

	return [
		'**Unbound Debug Info**',
		`> Unbound: ${info.client} (Loader ${info.loader}, ${info.loaderOrigin})`,
		`> Discord: ${info.discord} (${info.discordBuild}) via ${info.appSource}`,
		`> Platform: ${info.platform} ${info.os}`,
		`> Device: ${info.device}${flags}`,
		`> React: ${info.react} (RN ${info.reactNative})`,
		`> Hermes: ${info.hermes} (bcv${info.bytecode})`,
	].join('\n');
}

export default formatDebugInfo;
