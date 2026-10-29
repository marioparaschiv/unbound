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
 * @description Lists the client's debug information as Markdown bullets, one labelled line per component.
 * @param info The versions and device details.
 * @returns The lines, shared by `/debug` and the GitHub issue report.
 */
export function debugLines(info: DebugInfo): string[] {
	const loader = [info.loaderOrigin, info.framework]
		.filter(Boolean)
		.map((part) => `\`${part}\``)
		.join(', ');

	return [
		`- **Unbound:** ${info.client} (\`${info.commit}\`), loader ${info.loader} (${loader})`,
		`- **Discord:** ${info.discord}, build ${info.discordBuild} (${info.appSource})`,
		`- **Device:** ${info.device} on ${info.platform} ${info.os}`,
		`- **State:** ${info.flags.join(', ')}`,
		`- **Runtime:** React ${info.react}, React Native ${info.reactNative}, Hermes ${info.hermes} (HBC ${info.bytecode})`,
	];
}

/**
 * @description Formats the client's debug information as a Discord message: a heading and one labelled line per component.
 * @param info The versions and device details.
 * @returns The message text.
 */
export function formatDebugInfo(info: DebugInfo): string {
	return ['### Unbound Debug Info', ...debugLines(info)].join('\n');
}

export default formatDebugInfo;
