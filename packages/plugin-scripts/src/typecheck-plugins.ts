import { PLUGINS_DIR } from './paths';

export type PluginTypeErrors = { plugin: string; errors: string[] };

export function typeErrors(output: string): string[] {
	return output.split('\n').filter((line) => line.includes('error TS'));
}

function pluginDirectories(): string[] {
	return [...new Bun.Glob('*/tsconfig.json').scanSync(PLUGINS_DIR)]
		.map((path) => path.slice(0, path.indexOf('/')))
		.sort();
}

async function typecheck(plugin: string): Promise<PluginTypeErrors> {
	const child = Bun.spawn(['bunx', 'tsc', '-p', '.', '--noEmit'], {
		cwd: `${PLUGINS_DIR}/${plugin}`,
		stdout: 'pipe',
		stderr: 'pipe',
	});
	const [stdout, stderr] = await Promise.all([
		new Response(child.stdout).text(),
		new Response(child.stderr).text(),
		child.exited,
	]);

	return { plugin, errors: typeErrors(stdout + stderr) };
}

async function main(): Promise<void> {
	const queue = pluginDirectories();
	const results: PluginTypeErrors[] = [];
	const workers = Array.from({ length: Math.max(1, navigator.hardwareConcurrency) }, async () => {
		for (let plugin = queue.shift(); plugin; plugin = queue.shift()) {
			results.push(await typecheck(plugin));
		}
	});

	await Promise.all(workers);

	const failing = results.filter((result) => result.errors.length);

	for (const { plugin, errors } of failing) {
		for (const error of errors) console.error(`${plugin}/${error}`);
	}

	console.log(
		failing.length
			? `${failing.length} of ${results.length} plugins have type errors.`
			: `All ${results.length} plugins type-check.`,
	);

	if (failing.length) process.exitCode = 1;
}

if (import.meta.main) await main();
