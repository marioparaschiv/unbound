import { watch, type FSWatcher } from 'node:fs';
import { resolve, join, sep } from 'node:path';

import type { ReloadTransport, BuiltAddon } from '~/lib/reload-transport';
import type { DiscoveredAddon } from '~/lib/discovery';
import type { ResolvedConfig } from '~/lib/config';
import { discoverAddons } from '~/lib/discovery';
import { buildAddon } from '~/lib/build-addon';

/** How long file changes inside one addon settle before that addon rebuilds. */
const DEBOUNCE_MS = 150;

/**
 * Watches every discovered addon and rebuilds only the addon whose files changed, debounced per
 * addon. Directory creates and deletes under the workspace re-run discovery so addons added or
 * removed while the server runs are picked up. After each successful build the reload transport is
 * called; static addons skip the build step but still count as a successful build for reload.
 */
export class DevServer {
	private watcher: FSWatcher | null = null;
	private addons = new Map<string, DiscoveredAddon>();
	private readonly timers = new Map<string, ReturnType<typeof setTimeout>>();

	constructor(
		private readonly resolved: ResolvedConfig,
		private readonly transport: ReloadTransport,
	) {}

	/** @description Runs initial discovery, builds every addon once, then watches until {@link stop}ped. */
	async start(): Promise<void> {
		await this.rediscover();

		for (const addon of this.addons.values()) await this.rebuild(addon);

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

		this.scheduleRebuild(addon);
	}

	private scheduleRebuild(addon: DiscoveredAddon) {
		const existing = this.timers.get(addon.dir);
		if (existing) clearTimeout(existing);

		const timer = setTimeout(() => {
			this.timers.delete(addon.dir);
			void this.rebuild(addon);
		}, DEBOUNCE_MS);

		this.timers.set(addon.dir, timer);
	}

	private async rebuild(addon: DiscoveredAddon) {
		if (!addon.static) process.stdout.write(`Building ${addon.id}…\n`);

		const ok = await buildAddon(addon, this.resolved.config.build);

		if (!ok) {
			process.stderr.write(`Failed to build ${addon.id}.\n`);
			return;
		}

		if (!addon.static) process.stdout.write(`Built ${addon.id}.\n`);

		await this.transport.reload(toBuiltAddon(addon));
	}

	private async rediscover() {
		const discovered = await discoverAddons(this.resolved);
		const next = new Map(discovered.map((addon) => [addon.dir, addon]));

		for (const dir of this.addons.keys()) {
			if (!next.has(dir)) process.stdout.write(`Addon at ${dir} removed.\n`);
		}

		for (const [dir, addon] of next) {
			if (!this.addons.has(dir)) process.stdout.write(`Discovered addon ${addon.id}.\n`);
		}

		this.addons = next;
	}

	private findOwner(changedPath: string): DiscoveredAddon | undefined {
		for (const addon of this.addons.values()) {
			if (isInside(changedPath, addon.dir)) return addon;
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

function isManifestPath(changedPath: string): boolean {
	return changedPath.endsWith(join(sep, 'manifest.json'));
}

function toBuiltAddon(addon: DiscoveredAddon): BuiltAddon {
	return { id: addon.id, kind: addon.kind, dir: addon.dir, output: addon.output };
}

export default DevServer;
