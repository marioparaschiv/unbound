/** How many addons of one kind are installed and enabled. */
export type AddonCount = { enabled: number; installed: number };

/** Whether Unbound supports the running Discord: `unsupported` is older than the minimum, `untested` an Alpha build. */
export type DiscordSupport = 'supported' | 'untested' | 'unsupported';

/** What `/debug` reports about the running client. Every field but the addon counts is already a display string. */
export type DebugInfo = {
	client: string;
	commit: string;
	loader: string;
	loaderOrigin: string;
	framework: string;
	jailbreak?: string;
	discord: string;
	discordChannel: string;
	discordBuild: string;
	appSource: string;
	installDetails?: string;
	react: string;
	reactNative: string;
	hermes: string;
	bytecode: string;
	platform: string;
	os: string;
	device: string;
	flags: string[];
	plugins?: AddonCount;
	themes?: AddonCount;
	discordSupport?: DiscordSupport;
	disabledAddons?: string[];
	locale?: string;
	theme?: string;
	iconPack?: string;
};

function sentenceCase(text: string): string {
	return text.charAt(0).toUpperCase() + text.slice(1);
}

/**
 * @description Lists the client's debug information as Markdown bullets, one labelled line per component.
 * @param info The versions and device details.
 * @returns The lines, shared by `/debug` and the GitHub issue report.
 */
export function debugLines(info: DebugInfo): string[] {
	const loader = [info.loaderOrigin, info.jailbreak, info.framework]
		.filter(Boolean)
		.map((part) => `(\`${part}\`)`)
		.join(' ');

	return [
		`- **Unbound:** ${info.client} (\`${info.commit}\`), loader ${info.loader} ${loader}`,
		`- **Discord:** ${info.discord} ${info.discordChannel.toLowerCase()}, build ${info.discordBuild} (${info.appSource})${info.discordSupport && info.discordSupport !== 'supported' ? `, ${info.discordSupport}` : ''}`,
		`- **Device:** ${info.device} on ${info.platform} ${info.os}`,
		...(info.installDetails ? [`- **Install:** ${sentenceCase(info.installDetails)}`] : []),
		`- **State:** ${info.flags.join(' · ')}`,
		...(info.disabledAddons?.length
			? [`- **Disabled:** ${info.disabledAddons.join(' · ')}`]
			: []),
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
