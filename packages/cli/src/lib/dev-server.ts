import { LOCALES_DIRECTORY } from '@unbound-app/contracts/addon-locales';
import { MANIFEST_FILENAME } from '@unbound-app/contracts/manifest';
import toError from '@unbound-app/utils/to-error';
import { watch, type FSWatcher } from 'node:fs';
import { resolve, join, sep } from 'node:path';

import { LOCALE_TYPINGS, writeLocaleTypings } from '~/rollup/locales';
import type { ReloadTransport } from '~/lib/reload-transport';
import { SETTINGS_TYPINGS } from '~/rollup/settings-typings';
import type { DiscoveredAddon } from '~/lib/discovery';
import { DEV_BUILD_CHECKS } from '~/lib/build-checks';
import { createCheckCache } from '~/lib/check/check';
import { formatSummary } from '~/lib/report-format';
import type { ResolvedConfig } from '~/lib/config';
import { discoverAddons } from '~/lib/discovery';
import { buildAddon } from '~/lib/build-addon';

const GENERATED_TYPINGS = [SETTINGS_TYPINGS, LOCALE_TYPINGS];

/** How long file changes inside one addon settle before that addon rebuilds. */
const DEBOUNCE_MS = 150;

/**
 * Watches every discovered addon and rebuilds (debounced) and reloads only the one that changed.
 * Directory creates and deletes re-run discovery; static addons skip the build but still reload.
 */
export class DevServer {
	private watcher: FSWatcher | null = null;
	private addons = new Map<string, DiscoveredAddon>();
	private readonly timers = new Map<string, ReturnType<typeof setTimeout>>();
	// Unchanged files stay parsed between rebuilds.
	private readonly checkCache = createCheckCache();

	constructor(
		private readonly resolved: ResolvedConfig,
		private readonly transport: ReloadTransport,
		// Each rebuild reads its build report for the summary line only when asked; it slows every hot build.
		private readonly report = false,
	) {}

	/** @description Runs initial discovery, builds every addon once without pushing it, then watches until {@link stop}ped. */
	async start(): Promise<void> {
		await this.rediscover();

		// Pushing here would install every workspace addon on the device; only an addon being edited reloads.
		for (const addon of this.addons.values()) await this.rebuild(addon, false);

		this.watcher = watch(this.resolved.dir, { recursive: true }, (_event, filename) => {
			if (!filename) return;

			this.onChange(resolve(this.resolved.dir, filename));
		});
	}

	/** @description Tears the server down, clearing the watcher and any pending rebuilds. Twin of {@link start}. */
	stop(): void {
		this.watcher?.close();
		this.watcher = null;

		for (const timer of this.timers.values()) clearTimeout(timer);

		this.timers.clear();
	}

	private onChange(changedPath: string) {
		if (isIgnoredPath(changedPath)) return;

		if (isManifestPath(changedPath)) {
			void this.rediscover();

			return;
		}

		const addon = this.findOwner(changedPath);

		if (!addon) return;

		if (!addon.static && isInside(changedPath, addon.output)) return;

		// The build writes these from settings.ts and i18n/en-US.json, so a change to them is the build's own.
		if (GENERATED_TYPINGS.some((typings) => changedPath === join(addon.dir, typings))) return;

		if (isLocalePath(changedPath, addon.dir)) {
			this.refreshLocaleTypings(addon);
		}

		this.scheduleRebuild(addon);
	}

	// Runs ahead of the debounced rebuild, so the editor sees a new key as soon as en-US.json is saved.
	private refreshLocaleTypings(addon: DiscoveredAddon) {
		try {
			if (writeLocaleTypings(addon.dir)) {
				process.stdout.write(`Updated the ${LOCALE_TYPINGS} typings of ${addon.id}.\n`);
			}
		} catch (error) {
			process.stderr.write(
				`Failed to update the ${LOCALE_TYPINGS} typings of ${addon.id}: ${toError(error).message}\n`,
			);
		}
	}

	private scheduleRebuild(addon: DiscoveredAddon) {
		const existing = this.timers.get(addon.dir);

		if (existing) {
			clearTimeout(existing);
		}

		const timer = setTimeout(() => {
			this.timers.delete(addon.dir);
			void this.rebuild(addon);
		}, DEBOUNCE_MS);

		this.timers.set(addon.dir, timer);
	}

	private async rebuild(addon: DiscoveredAddon, reload = true) {
		if (!addon.static) {
			process.stdout.write(`Building ${addon.id}…\n`);
		}

		const { ok, report } = await buildAddon(addon, {
			command: this.resolved.config.build,
			hot: true,
			checks: DEV_BUILD_CHECKS,
			cache: this.checkCache,
			report: this.report,
		});

		if (!ok) {
			process.stderr.write(`Failed to build ${addon.id}.\n`);

			return;
		}

		if (!addon.static) {
			process.stdout.write(
				report ? `Built ${addon.id}: ${formatSummary(report)}\n` : `Built ${addon.id}.\n`,
			);
		}

		if (reload) {
			await this.transport.reload(addon);
		}
	}

	private async rediscover() {
		const discovered = await discoverAddons(this.resolved);
		const next = new Map(discovered.map((addon) => [addon.dir, addon]));

		for (const dir of this.addons.keys()) {
			if (!next.has(dir)) {
				process.stdout.write(`Addon at ${dir} removed.\n`);
			}
		}

		for (const [dir, addon] of next) {
			if (!this.addons.has(dir)) {
				process.stdout.write(`Discovered addon ${addon.id}.\n`);
			}
		}

		this.addons = next;
	}

	private findOwner(changedPath: string): DiscoveredAddon | undefined {
		for (const addon of this.addons.values()) {
			if (isInside(changedPath, addon.dir)) {
				return addon;
			}
		}

		return void 0;
	}
}

/** Directory names whose contents are never source and would otherwise churn the watcher. */
const IGNORED_SEGMENTS = new Set(['node_modules', '.git']);

function isIgnoredPath(changedPath: string): boolean {
	return changedPath.split(sep).some((segment) => IGNORED_SEGMENTS.has(segment));
}

function isInside(changedPath: string, dir: string): boolean {
	return changedPath === dir || changedPath.startsWith(dir + sep);
}

function isLocalePath(changedPath: string, dir: string): boolean {
	return isInside(changedPath, join(dir, LOCALES_DIRECTORY)) && changedPath.endsWith('.json');
}

function isManifestPath(changedPath: string): boolean {
	return changedPath.endsWith(join(sep, MANIFEST_FILENAME));
}

export default DevServer;
