import { TraceMap, originalPositionFor } from '@jridgewell/trace-mapping';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const ADDON_ROW = /^\|\s*Addon\s*\|\s*(\S+)\s+(\d+\.\d+\.\d+)\b/m;
const PLUGIN_FRAME = /\(:(\d+):(\d+)\)/g;
const MARKER = '<!-- unbound-plugin-symbolicated -->';
const PLUGINS = join(import.meta.dir, '..', 'packages', 'plugins');

/** What a crash issue needs for a first-party plugin's frames to be mapped. */
export type PluginCrash = { id: string; version: string; stack: string };

function stackSection(body: string): string | undefined {
	const section = body
		.split(/^### /m)
		.find((part) => part.startsWith('Stack') || part.startsWith('Error'));

	return section?.replace(/^(Stack|Error)\s*/, '').trim();
}

/**
 * @description Finds the plugin, its version and the stack in a crash issue the server or the crash form opened.
 * @param body The issue body.
 * @returns The crash, or `undefined` when no addon is named or the stack has no plugin frames.
 */
export function parsePluginCrash(body: string): PluginCrash | undefined {
	const addon = ADDON_ROW.exec(body);
	const stack = stackSection(body);

	if (!addon?.[1] || !addon[2] || !stack || body.includes(MARKER)) {
		return undefined;
	}

	PLUGIN_FRAME.lastIndex = 0;

	return PLUGIN_FRAME.test(stack) ? { id: addon[1], version: addon[2], stack } : undefined;
}

/**
 * @description Rewrites the plugin's own frames, printed by Hermes as `(:line:column)` with a 1-based column, to the
 * source positions the plugin's rollup map names.
 * @param stack The stack as Hermes printed it.
 * @param map The plugin's `index.js.map`.
 * @returns The stack with the plugin's frames rewritten; frames the map can't place are left as printed.
 */
export function mapPluginFrames(stack: string, map: string): string {
	const trace = new TraceMap(map);

	return stack.replace(PLUGIN_FRAME, (frame, line: string, column: string) => {
		const position = originalPositionFor(trace, {
			line: Number(line),
			column: Math.max(0, Number(column) - 1),
		});

		return position.source
			? `(${position.source.replace(/^(\.\.\/)+/, '')}:${position.line}:${position.column + 1})`
			: frame;
	});
}

/**
 * @description Writes the comment that answers a crash issue with the plugin's frames mapped to source.
 * @param crash The crash.
 * @param commit The commit the plugin was rebuilt at.
 * @param mapped The stack with the plugin's frames rewritten.
 * @returns The comment's Markdown.
 */
export function pluginSymbolsComment(crash: PluginCrash, commit: string, mapped: string): string {
	return `${MARKER}\n\`${crash.id}\` ${crash.version} frames, mapped with a rebuild at \`${commit.slice(0, 9)}\`:\n\n\`\`\`\n${mapped.replaceAll('```', '').trim()}\n\`\`\`\n`;
}

function pluginDirectory(id: string): string | undefined {
	return readdirSync(PLUGINS).find((name) => {
		const manifest = join(PLUGINS, name, 'manifest.json');

		return existsSync(manifest) && JSON.parse(readFileSync(manifest, 'utf8')).id === id;
	});
}

async function gh(...args: string[]): Promise<string> {
	return (await Bun.$`gh ${args}`.quiet().text()).trim();
}

async function releaseCommit(directory: string, version: string): Promise<string | undefined> {
	const manifest = `packages/plugins/${directory}/manifest.json`;
	const log = await Bun.$`git log --format=%H -S${`"version": "${version}"`} -- ${manifest}`
		.quiet()
		.text();

	return log.trim().split('\n').filter(Boolean).at(-1);
}

async function rebuiltMap(
	directory: string,
	commit: string,
	worktree: string,
): Promise<string | undefined> {
	await Bun.$`rm -rf ${worktree}`.quiet();
	await Bun.$`git worktree add --detach ${worktree} ${commit}`.quiet();
	await Bun.$`bun install --frozen-lockfile`.cwd(worktree).quiet();

	const plugin = join(worktree, 'packages', 'plugins', directory);

	await Bun.$`bunx rollup -c`.cwd(plugin).quiet();

	const map = join(plugin, 'dist', 'index.js.map');

	return existsSync(map) ? readFileSync(map, 'utf8') : undefined;
}

async function main(repository: string, issue: string, dryRun: boolean): Promise<void> {
	const body = await gh(
		'issue',
		'view',
		issue,
		'--repo',
		repository,
		'--json',
		'body',
		'--jq',
		'.body',
	);
	const crash = parsePluginCrash(body);
	const directory = crash && pluginDirectory(crash.id);

	if (!crash || !directory) {
		console.log('The issue names no first-party plugin with frames to map.');

		return;
	}

	const commit = await releaseCommit(directory, crash.version);

	if (!commit) {
		console.log(`No commit released ${crash.id} ${crash.version}.`);

		return;
	}

	const worktree = `${process.env.RUNNER_TEMP ?? '/tmp'}/unbound-plugin-maps-${issue}`;
	const map = await rebuiltMap(directory, commit, worktree);

	if (!map) {
		console.log(`${crash.id} ${crash.version} predates plugin source maps.`);

		return;
	}

	const mapped = mapPluginFrames(crash.stack, map);

	if (mapped === crash.stack) {
		console.log('No plugin frame could be mapped.');

		return;
	}

	const comment = pluginSymbolsComment(crash, commit, mapped);

	if (dryRun) {
		console.log(comment);

		return;
	}

	await Bun.write(`${worktree}.md`, comment);
	await gh('issue', 'comment', issue, '--repo', repository, '--body-file', `${worktree}.md`);
}

if (import.meta.main) {
	const [repository, issue, flag] = Bun.argv.slice(2);

	if (!repository || !issue) {
		throw new Error(
			'Usage: bun scripts/symbolicate-plugin-issue.ts <owner/name> <issue> [--dry-run]',
		);
	}

	await main(repository, issue, flag === '--dry-run');
}
