export type CommandResult = { code: number; output: string };

/**
 * @description Runs a command to completion with no input, collecting its output.
 * @param command The command and its arguments.
 * @param cwd The directory to run it in.
 * @param env The environment, the current one when omitted.
 * @returns Its exit code, and its stdout followed by its stderr.
 */
export async function runCommand(
	command: string[],
	cwd: string,
	env?: Record<string, string | undefined>,
): Promise<CommandResult> {
	const child = Bun.spawn(command, { cwd, env, stdin: 'ignore', stdout: 'pipe', stderr: 'pipe' });
	const [stdout, stderr, code] = await Promise.all([
		new Response(child.stdout).text(),
		new Response(child.stderr).text(),
		child.exited,
	]);

	return { code, output: stdout + stderr };
}
