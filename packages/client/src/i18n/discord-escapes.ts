/**
 * @description Rewrites ICU quoting for Discord's `MessageFormat`, which reads backslash escapes instead: `'{x}'` becomes
 * `\{x\}`, `''` one apostrophe, and a literal backslash `\\`. The CLI's checks and the testing kit read ICU quoting.
 * @param message The ICU message.
 * @returns The message in Discord's escaping.
 */
export function toDiscordEscapes(message: string): string {
	let output = '';

	for (let index = 0; index < message.length; index++) {
		const char = message[index] ?? '';
		const next = message[index + 1] ?? '';

		if (char === '\\') {
			output += '\\\\';
		} else if (char === "'" && next === "'") {
			output += "'";
			index++;
		} else if (char === "'" && '{}#'.includes(next) && next) {
			// Quoted up to the next lone apostrophe, where `''` stays one apostrophe.
			for (index++; index < message.length; index++) {
				const quoted = message[index] ?? '';

				if (quoted === "'" && message[index + 1] === "'") {
					output += "'";
					index++;
				} else if (quoted === "'") {
					break;
				} else {
					output += '{}#\\'.includes(quoted) ? `\\${quoted}` : quoted;
				}
			}
		} else {
			output += char;
		}
	}

	return output;
}

export default toDiscordEscapes;
