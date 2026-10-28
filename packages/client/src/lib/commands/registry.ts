import type { CommandRecord, Section } from '~/lib/commands/normalize';
import { CommandDefinitionError } from '~/lib/commands/normalize';

/** One section's commands at one version. */
export type SectionView = {
	readonly section: Section;
	readonly commands: readonly CommandRecord[];
};

/** Everything registered, frozen at one version. Rebuilt at most once per version. */
export type RegistrySnapshot = {
	readonly version: number;
	readonly sections: readonly SectionView[];
	readonly sectionIds: ReadonlySet<string>;
};

export type Registry = {
	/** Adds records under an owner, replacing whole roots it already has. Returns a remover for this call. */
	add(owner: string, records: readonly CommandRecord[]): () => void;
	/** Removes every record of an owner. Idempotent. */
	release(owner: string): void;
	snapshot(): RegistrySnapshot;
	/** Calls the listener after every change that bumped the version. */
	subscribe(listener: () => void): () => void;
};

type MutableView = {
	section: Section;
	commands: CommandRecord[];
};

type RootEntry = {
	token: symbol;
	records: readonly CommandRecord[];
};

/**
 * @description Creates a command registry. Records are kept per owner and root, and merged into sections
 * only when read, so one owner's changes never touch another owner's records.
 * @returns The registry.
 */
export function createRegistry(): Registry {
	const owners = new Map<string, Map<string, RootEntry>>();
	const listeners = new Set<() => void>();
	let version = 0;
	let cached: RegistrySnapshot | undefined;

	function bump() {
		version++;
		cached = undefined;

		for (const listener of listeners) {
			listener();
		}
	}

	function assertFree(owner: string, roots: Map<string, CommandRecord[]>) {
		const ids = new Set([...roots.values()].flat().map((record) => record.id));

		for (const [other, entries] of owners) {
			if (other === owner) {
				continue;
			}

			for (const [root, entry] of entries) {
				const taken = roots.has(root) || entry.records.some((record) => ids.has(record.id));

				if (taken) {
					throw new CommandDefinitionError(
						owner,
						root,
						`/${root} is already registered by ${other}.`,
					);
				}
			}
		}
	}

	function add(owner: string, records: readonly CommandRecord[]): () => void {
		const roots = new Map<string, CommandRecord[]>();

		for (const record of records) {
			const root = record.path[0];

			roots.set(root, [...(roots.get(root) ?? []), record]);
		}

		if (!roots.size) {
			return () => {};
		}

		assertFree(owner, roots);

		const token = Symbol(owner);
		const entries = owners.get(owner) ?? new Map<string, RootEntry>();

		for (const [root, rootRecords] of roots) {
			entries.set(root, { token, records: rootRecords });
		}

		owners.set(owner, entries);
		bump();

		return () => {
			// A release since this call already removed everything it added.
			if (owners.get(owner) !== entries) return;

			let removed = false;

			for (const root of roots.keys()) {
				if (entries.get(root)?.token !== token) {
					continue;
				}

				entries.delete(root);
				removed = true;
			}

			if (!entries.size) {
				owners.delete(owner);
			}

			if (removed) {
				bump();
			}
		};
	}

	function release(owner: string) {
		if (owners.delete(owner)) {
			bump();
		}
	}

	function snapshot(): RegistrySnapshot {
		cached ??= build(version, owners);

		return cached;
	}

	function subscribe(listener: () => void): () => void {
		listeners.add(listener);

		return () => void listeners.delete(listener);
	}

	return { add, release, snapshot, subscribe };
}

function build(version: number, owners: Map<string, Map<string, RootEntry>>): RegistrySnapshot {
	const sections = new Map<string, MutableView>();

	for (const entries of owners.values()) {
		for (const { records } of entries.values()) {
			for (const record of records) {
				const view = sections.get(record.section.id);

				if (view) {
					view.commands.push(record);
				} else {
					sections.set(record.section.id, {
						section: record.section,
						commands: [record],
					});
				}
			}
		}
	}

	return Object.freeze({
		version,
		sections: Object.freeze([...sections.values()]),
		sectionIds: new Set(sections.keys()),
	});
}

/** The registry every owner shares. */
export const registry = createRegistry();
