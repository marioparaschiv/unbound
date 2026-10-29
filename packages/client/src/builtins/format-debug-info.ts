/** What `/debug` reports about the running client. Every field is already a display string. */
export type DebugInfo = {
	client: string;
	commit: string;
	loader: string;
	loaderOrigin: string;
	framework: string;
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
 * @description Formats the client's debug information as a Discord message: a heading and one labelled line per component.
 * @param info The versions and device details.
 * @returns The message text.
 */
export function formatDebugInfo(info: DebugInfo): string {
	const loader = [info.loaderOrigin, info.framework]
		.filter(Boolean)
		.map((part) => `\`${part}\``)
		.join(', ');

	return [
		'### Unbound Debug Info',
		`- **Unbound:** ${info.client} (\`${info.commit}\`), loader ${info.loader} (${loader})`,
		`- **Discord:** ${info.discord}, build ${info.discordBuild} (\`${info.appSource}\`)`,
		`- **Device:** ${info.device} on ${info.platform} ${info.os}`,
		`- **State:** ${info.flags.join(', ')}`,
		`- **Runtime:** React ${info.react}, React Native ${info.reactNative}, Hermes ${info.hermes} (HBC ${info.bytecode})`,
	].join('\n');
}

export default formatDebugInfo;
