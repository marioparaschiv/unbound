import type { CommandOutput } from '@unbound-app/debugger-protocol/registry';
import { resolve, sep } from 'node:path';
import pc from 'picocolors';

import { formatReport, formatReportLine, formatSummary, summarize } from '~/lib/check/report';
import { discoverAddons, type DiscoveredAddon } from '~/lib/discovery';
import { listCheckIds, selectChecks } from '~/lib/check/registry';
import { watchChecks, type WatchUpdate } from '~/lib/check/watch';
import type { CommandHandler } from '~/lib/lazy-handler';
import type { AddonDiagnostics } from '~/lib/check/run';
import { checkAddons } from '~/lib/check/check-addons';
import { createCheckCache } from '~/lib/check/check';
import { checkInShards } from '~/lib/check/shard';
import { hasFailures } from '~/lib/check/run';
import { loadConfig } from '~/lib/config';

import type checkCommand from './check';

type Selected = { addons: DiscoveredAddon[] } | { error: string };

type CheckRun = (addons: readonly DiscoveredAddon[]) => Promise<AddonDiagnostics[]>;

async function selectAddons(plugins: readonly string[], all: boolean): Promise<Selected> {
	const targets = (plugins.length ? plugins : ['.']).map((plugin) => resolve(plugin));
	const resolved = loadConfig(targets[0]);

	if ('error' in resolved) {
		return resolved;
	}

	const addons = await discoverAddons(resolved);

	if (all) {
		return addons.length ? { addons } : { error: 'No addons found.' };
	}

	const selected: DiscoveredAddon[] = [];

	for (const target of targets) {
		const owner = addons
			.filter((addon) => target === addon.dir || target.startsWith(`${addon.dir}${sep}`))
			.sort((a, b) => b.dir.length - a.dir.length)[0];

		if (!owner) {
			return {
				error: `No addon holds ${target}. Pass --plugin <dir>, or --all for every addon.`,
			};
		}

		selected.push(owner);
	}

	return { addons: selected };
}

function toJson(results: readonly AddonDiagnostics[]) {
	return results.flatMap(({ addon, diagnostics }) =>
		diagnostics.map((diagnostic) => ({ addon: addon.id, dir: addon.dir, ...diagnostic })),
	);
}

function report(results: readonly AddonDiagnostics[], strict: boolean): CommandOutput {
	const summary = summarize(results);
	const text = [formatReport(results, process.cwd()), formatSummary(summary, results.length)]
		.filter(Boolean)
		.join('\n\n');
	const failed = hasFailures(
		results.flatMap((result) => result.diagnostics),
		strict,
	);

	return { ok: !failed, text, data: { summary, diagnostics: toJson(results) } };
}

function printUpdate(update: WatchUpdate, json: boolean) {
	const summary = summarize(update.results);

	if (json) {
		process.stdout.write(
			`${JSON.stringify({ initial: update.initial, summary, added: toJson(update.added), removed: toJson(update.removed) })}\n`,
		);

		return;
	}

	const cwd = process.cwd();
	const lines = [
		...update.removed.flatMap(({ addon, diagnostics }) =>
			diagnostics.map((diagnostic) => formatReportLine(addon, diagnostic, cwd, true)),
		),
		formatReport(update.added, cwd),
	].filter(Boolean);
	const time = new Date().toLocaleTimeString();

	process.stdout.write(
		`${lines.length ? `${lines.join('\n')}\n` : ''}${pc.dim(`[${time}]`)} ${formatSummary(summary, update.results.length)}\n`,
	);
}

function watchUntilInterrupted(
	addons: DiscoveredAddon[],
	check: CheckRun,
	json: boolean,
): Promise<CommandOutput> {
	return new Promise((done) => {
		void watchChecks({
			addons,
			check,
			onUpdate: (update) => printUpdate(update, json),
		}).then((watcher) => {
			process.once('SIGINT', () => {
				watcher.stop();
				done({ ok: true, text: 'Stopped watching.' });
			});
		});
	});
}

const handler: CommandHandler<typeof checkCommand.schema> = async ({
	plugin,
	all,
	watch,
	only,
	strict,
	types,
	declaredCapabilities,
	json,
}) => {
	const ids = only
		.flatMap((value) => value.split(','))
		.map((id) => id.trim())
		.filter(Boolean);
	const selection = selectChecks({ declaredCapabilities, types, only: ids });

	if ('unknown' in selection) {
		return {
			ok: false,
			text: `Unknown check ${selection.unknown.join(', ')}; the checks are ${listCheckIds().join(', ')}.`,
		};
	}

	const selected = await selectAddons(plugin, all);

	if ('error' in selected) {
		return { ok: false, text: selected.error };
	}

	const cache = createCheckCache();
	const forwarded = [
		...(ids.length ? ['--only', ids.join(',')] : []),
		...(types ? ['--types'] : []),
		...(declaredCapabilities ? ['--declared-capabilities'] : []),
	];
	// `--all` spreads its first run over a process per core; a re-run checks one addon in place.
	const check: CheckRun = (targets) =>
		all && targets.length > 1
			? checkInShards(targets, forwarded)
			: checkAddons(targets, selection, cache);

	if (watch) {
		return watchUntilInterrupted(selected.addons, check, json);
	}

	return report(await check(selected.addons), strict);
};

export default handler;
