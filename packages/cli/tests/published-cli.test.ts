import {
	existsSync,
	mkdirSync,
	readFileSync,
	realpathSync,
	symlinkSync,
	writeFileSync,
} from 'node:fs';
import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { dirname, join } from 'node:path';
import { createServer } from 'node:net';

import { installPublished } from './helpers/published-package';
import { createTempDir, type TempDir } from './helpers/ubd';

const CLI = join(import.meta.dir, '..');
const API = join(CLI, '..', 'api');
const ROLLUP = realpathSync(join(CLI, 'node_modules', 'rollup'));

/** What the plugin template installs besides the CLI; the CLI itself comes from its published build. */
const PLUGIN_PACKAGES = {
	'@unbound-app/api': API,
	react: realpathSync(join(API, 'node_modules', 'react')),
	'react-native': realpathSync(join(API, 'node_modules', 'react-native')),
	typescript: realpathSync(join(CLI, 'node_modules', 'typescript')),
	rollup: ROLLUP,
	'.bin/rollup': join(ROLLUP, 'dist', 'bin', 'rollup'),
};

const WORKLET_CLASS = `class Counter {
	__workletClass = true;
	count = 0;

	increment() {
		return ++this.count;
	}
}

export function spin(): number {
	'worklet';

	return new Counter().increment();
}
`;

let user: TempDir;
let ubd: string;

async function run(command: string[], cwd: string) {
	const child = Bun.spawn(command, {
		cwd,
		env: { ...process.env, NO_COLOR: '1' },
		stdin: 'ignore',
		stdout: 'pipe',
		stderr: 'pipe',
	});
	const [exitCode, stdout, stderr] = await Promise.all([
		child.exited,
		new Response(child.stdout).text(),
		new Response(child.stderr).text(),
	]);

	return { exitCode, output: stdout + stderr };
}

function freePort(): Promise<number> {
	return new Promise((resolve) => {
		const server = createServer().listen(0, () => {
			const address = server.address();

			server.close(() => resolve(typeof address === 'object' && address ? address.port : 0));
		});
	});
}

async function stopListeners(port: number) {
	const { output } = await run(['lsof', '-nP', `-iTCP:${port}`, '-sTCP:LISTEN', '-t'], user.path);

	for (const pid of output.split('\n').map(Number).filter(Boolean)) {
		process.kill(pid);
	}
}

function linkPluginPackages(root: string) {
	for (const [name, target] of Object.entries(PLUGIN_PACKAGES)) {
		const link = join(root, 'node_modules', name);

		mkdirSync(dirname(link), { recursive: true });
		symlinkSync(target, link);
	}
}

beforeAll(() => {
	user = createTempDir();
	installPublished('@unbound-app/cli', join(user.path, 'node_modules'));
	linkPluginPackages(user.path);
	ubd = join(user.path, 'node_modules', '.bin', 'ubd');
}, 120_000);

afterAll(() => user.remove());

describe('the published CLI', () => {
	test('runs from its installed bin', async () => {
		const { exitCode, output } = await run([ubd, '--help'], user.path);

		expect({ exitCode, output }).toMatchObject({ exitCode: 0 });
		expect(output).toContain('Scaffold a new Unbound addon');
	});

	test(
		'scaffolds a plugin that builds with settings and a worklet class',
		async () => {
			const created = await run(
				[
					ubd,
					'create',
					'--kind=plugin',
					'--name=hello-world',
					'--shape=repository',
					'--dir=hello',
					'--display-name=Hello World',
					'--description=Greets you when it starts.',
					'--author-name=Wumpus',
					'--author-id=123456789012345678',
					'--id=wumpus.hello-world',
					'--git-init=false',
					'--install=false',
				],
				user.path,
			);

			expect(created).toMatchObject({ exitCode: 0 });
			// `ubd` is only on the PATH of a global install, so the next steps run it through bunx.
			expect(created.output).toContain('bun install');
			expect(created.output).toContain('bunx @unbound-app/cli dev');

			const plugin = join(user.path, 'hello', 'plugins', 'hello-world');
			const entry = join(plugin, 'src', 'index.tsx');

			writeFileSync(join(plugin, 'src', 'spin.ts'), WORKLET_CLASS);
			writeFileSync(
				entry,
				`${readFileSync(entry, 'utf8')}\nexport { spin as stop } from './spin';\n`,
			);

			const built = await run([ubd, 'build'], join(user.path, 'hello'));

			expect(built).toMatchObject({ exitCode: 0 });
			expect(readFileSync(join(plugin, 'dist', 'index.js'), 'utf8')).toContain(
				'Counter__classFactory',
			);
		},
		{ timeout: 120_000 },
	);

	test('names the flags create needs when it cannot prompt', async () => {
		const { exitCode, output } = await run(
			[ubd, 'create', '--kind=plugin', '--name=unprompted', '--shape=repository'],
			user.path,
		);

		expect(exitCode).toBe(2);
		expect(output).toContain('--display-name, --description, --author-name');
		expect(output).toContain('--git-init, --install');
		expect(existsSync(join(user.path, 'unprompted'))).toBe(false);
	});

	test(
		'starts the debugger bridge',
		async () => {
			const port = await freePort();

			try {
				const started = await run([ubd, 'bridge', 'start', `--port=${port}`], user.path);

				expect(started).toMatchObject({ exitCode: 0 });
			} finally {
				await stopListeners(port);
			}
		},
		{ timeout: 30_000 },
	);
});
