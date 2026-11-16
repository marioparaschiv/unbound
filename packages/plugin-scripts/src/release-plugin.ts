import { existsSync } from 'node:fs';
import { join, relative } from 'node:path';
import { parseArgs } from 'node:util';

import { readPluginManifest } from './plugin-manifests';
import { PLUGIN_ICONS_DIR, PLUGIN_README_ICONS_DIR, PLUGINS_DIR, REPO_ROOT } from './paths';

const MAX_HEADER_LENGTH = 72;
const CONVENTIONAL_HEADER =
	/^(feat|fix|perf|refactor|docs|chore|style|test|build|ci|revert)\([a-z0-9-]+\)!?: \S/;
const CLI = join(REPO_ROOT, 'packages/cli/src/index.ts');

/** What `plugins:release` was asked to do. */
export type ReleaseRequest = { slug: string; title: string; body: string; merge: boolean };

/**
 * @description Checks a commit header the way commitlint will, before anything is committed: `type(scope): subject`
 * in at most 72 characters.
 * @param title The header.
 * @returns Why it would be rejected, or `undefined` when it is fine.
 */
export function headerProblem(title: string): string | undefined {
	if (title.length > MAX_HEADER_LENGTH) {
		return `The title is ${title.length} characters; commitlint allows ${MAX_HEADER_LENGTH}.`;
	}

	return CONVENTIONAL_HEADER.test(title)
		? undefined
		: 'The title must read type(scope): subject, such as feat(petpet): pat avatars.';
}

/**
 * @description Names the release branch after the title's type and the plugin, such as `feat/petpet`.
 * @param slug The plugin's folder name.
 * @param title The commit header.
 * @returns The branch name.
 */
export function releaseBranch(slug: string, title: string): string {
	return `${title.slice(0, title.indexOf('('))}/${slug}`;
}

/**
 * @description Lists what a plugin release commits: the plugin, the plugins README, the icon folders the scripts
 * write and the lockfile, as paths from the repository root.
 * @param slug The plugin's folder name.
 * @returns The paths to stage.
 */
export function releasePaths(slug: string): string[] {
	return [
		join(PLUGINS_DIR, slug),
		join(PLUGINS_DIR, 'README.md'),
		PLUGIN_ICONS_DIR,
		PLUGIN_README_ICONS_DIR,
		join(REPO_ROOT, 'bun.lock'),
	].map((path) => relative(REPO_ROOT, path));
}

function run(command: string[], cwd = REPO_ROOT): string {
	console.log(`\n$ ${command.join(' ')}`);

	const result = Bun.spawnSync(command, { cwd, stdout: 'pipe', stderr: 'inherit' });
	const output = result.stdout.toString();

	process.stdout.write(output);

	if (!result.success) {
		throw new Error(`${command.join(' ')} failed with exit code ${result.exitCode}.`);
	}

	return output.trim();
}

function checkPlugin(slug: string): void {
	const directory = join(PLUGINS_DIR, slug);

	run(['bun', CLI, 'check'], directory);
	run(['bunx', 'tsc', '--noEmit', '-p', directory]);
	run([
		'bunx',
		'oxlint',
		'-c',
		join(PLUGINS_DIR, '.oxlintrc.json'),
		'--type-aware',
		join(directory, 'src'),
	]);

	if (existsSync(join(directory, 'tests'))) {
		run(['bun', 'test'], directory);
	}

	run(['bun', 'run', 'plugins:validate']);
}

function refreshAssets(slug: string): void {
	run(['bun', 'run', 'plugins:sync-icons']);
	run(['bun', 'run', 'plugins:banners', slug]);
	run(['bun', 'run', 'plugins:readme']);
}

function ensureReleasable(): void {
	if (run(['git', 'branch', '--show-current']) !== 'main') {
		throw new Error('Run the release from main.');
	}

	if (run(['git', 'diff', '--cached', '--name-only'])) {
		throw new Error('Something is already staged; commit or unstage it first.');
	}
}

function ship({ slug, title, body, merge }: ReleaseRequest): void {
	const branch = releaseBranch(slug, title);

	run(['git', 'switch', '-c', branch]);
	run(['git', 'add', '--', ...releasePaths(slug)]);
	run(['git', 'commit', '-m', title]);
	run(['git', 'push', '-u', 'origin', branch]);

	const url =
		run(['gh', 'pr', 'create', '--title', title, '--body', body]).split('\n').at(-1) ?? '';

	console.log(`\nOpened ${url}`);

	if (!merge) {
		return;
	}

	run(['gh', 'pr', 'merge', url, '--squash', '--admin']);
	run(['git', 'switch', 'main']);
	run(['git', 'pull', '--ff-only']);
}

function readRequest(argv: string[]): ReleaseRequest {
	const { values, positionals } = parseArgs({
		args: argv,
		allowPositionals: true,
		options: {
			title: { type: 'string' },
			body: { type: 'string' },
			'no-merge': { type: 'boolean', default: false },
		},
	});
	const [slug] = positionals;

	if (!slug || !values.title) {
		throw new Error(
			'Usage: bun run plugins:release <plugin-folder> --title "feat(<plugin>): …" [--body "…"] [--no-merge]',
		);
	}

	const manifestPath = join(PLUGINS_DIR, slug, 'manifest.json');

	if (!existsSync(manifestPath)) {
		throw new Error(`No plugin folder packages/plugins/${slug}.`);
	}

	return {
		slug,
		title: values.title,
		body: values.body ?? readPluginManifest(manifestPath).description,
		merge: !values['no-merge'],
	};
}

/**
 * @description Releases one plugin in one go: checks it, syncs icons, draws its banner and the README, then commits
 * on a branch, opens a pull request and squash-merges it.
 * @param argv The command-line arguments.
 */
export function releasePlugin(argv: string[]): void {
	const request = readRequest(argv);
	const problem = headerProblem(request.title);

	if (problem) {
		throw new Error(problem);
	}

	ensureReleasable();
	checkPlugin(request.slug);
	refreshAssets(request.slug);
	ship(request);
}

if (import.meta.main) {
	releasePlugin(process.argv.slice(2));
}
