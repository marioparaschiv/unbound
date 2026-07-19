/**
 * @description Whether stdin is piped rather than an interactive terminal, meaning a command may read
 * its input from it.
 * @returns `true` when stdin is not a TTY.
 */
export function isStdinPiped(): boolean {
	return !process.stdin.isTTY;
}

/**
 * @description Reads all of stdin to a trimmed string, for commands fed their input through a pipe.
 * @returns The piped input.
 */
export async function readStdin(): Promise<string> {
	const chunks: Buffer[] = [];

	for await (const chunk of process.stdin) chunks.push(chunk as Buffer);

	return Buffer.concat(chunks).toString('utf8').trim();
}
export default { isStdinPiped, readStdin };
