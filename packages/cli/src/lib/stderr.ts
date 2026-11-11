/**
 * @description Writes a progress line to stderr, which stays clear of the MCP's stdout.
 * @param message The line to write.
 */
export function logToStderr(message: string) {
	process.stderr.write(`${message}\n`);
}

export default logToStderr;
