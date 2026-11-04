import { PLUGINS_DIR } from './paths';

export type PluginTestRun = { plugin: string; passed: boolean; output: string };

/**
 * @description Lists the plugins that have tests, each run from its own folder so its bunfig.toml preload applies.
 * @param dir The folder holding the plugins.
 * @returns The plugin folder names, sorted.
 */
export function pluginsWithTests(dir: string = PLUGINS_DIR): string[] {
	const plugins = [...new Bun.Glob('*/{src,tests}/**/*.test.{ts,tsx}').scanSync(dir)].map(
		(path) => path.slice(0, path.indexOf('/')),
	);

	return [...new Set(plugins)].sort();
}

async function test(plugin: string): Promise<PluginTestRun> {
	const child = Bun.spawn([process.execPath, 'test'], {
		cwd: `${PLUGINS_DIR}/${plugin}`,
		stdout: 'pipe',
		stderr: 'pipe',
	});
	const [stdout, stderr, code] = await Promise.all([
		new Response(child.stdout).text(),
		new Response(child.stderr).text(),
		child.exited,
	]);

	return { plugin, passed: code === 0, output: (stdout + stderr).trim() };
}

async function main(): Promise<void> {
	const queue = pluginsWithTests();
	const results: PluginTestRun[] = [];
	const workers = Array.from(
		{ length: Math.max(1, Math.floor(navigator.hardwareConcurrency / 2)) },
		async () => {
			for (let plugin = queue.shift(); plugin; plugin = queue.shift()) {
				results.push(await test(plugin));
			}
		},
	);

	await Promise.all(workers);

	const failing = results.filter((result) => !result.passed);

	for (const { plugin, output } of failing) console.error(`\n${plugin}:\n${output}`);

	console.log(
		failing.length
			? `${failing.length} of ${results.length} plugins have failing tests.`
			: `All ${results.length} plugins pass their tests.`,
	);

	if (failing.length) process.exitCode = 1;
}

if (import.meta.main) await main();
