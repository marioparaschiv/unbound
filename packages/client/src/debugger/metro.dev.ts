import type {
	MetroChildrenRequest,
	MetroChildrenResult,
	MetroErrorCode,
	MetroFile,
	MetroFilesRequest,
	MetroFilesResult,
	MetroLoadAllRequest,
	MetroLoadAllResult,
	MetroMatch,
	MetroModule,
	MetroModulesRequest,
	MetroModulesResult,
	MetroRequest,
	MetroResult,
	MetroSearchRequest,
	MetroSearchResult,
	MetroValue,
} from '@unbound-app/debugger-protocol';
import {
	METRO_CHILDREN_PAGE_SIZE,
	METRO_MODULES_PAGE_SIZE,
	METRO_SEARCH_PAGE_SIZE,
	failMetroRequest,
} from '@unbound-app/debugger-protocol';
import { createLogger } from '@unbound-app/logger';

import {
	errorPreview,
	listChildren,
	previewValue,
	type InspectChild,
} from '~/metro/inspect-value.dev';
import {
	exportOwners,
	searchKeys,
	type ExportOwners,
	type KeyMatch,
} from '~/metro/search-keys.dev';
import { moduleExports, moduleLabel, moduleStatus, searchModules } from '~/metro/module-info.dev';
import { createObjectRegistry } from '~/debugger/explorer-objects.dev';
import { initializeModule } from '~/metro/search';

/** A getter not yet run: the ref of the object that owns it, and the key it sits under. */
class MetroGetter {
	constructor(
		readonly owner: string,
		readonly key: string,
		readonly read: InspectChild['read'],
	) {}
}

/** A request the device answers with an error code rather than a result. */
class MetroFailure extends Error {
	constructor(
		readonly code: MetroErrorCode,
		message: string,
	) {
		super(message);
	}
}

/** What a Metro ref stands for: an object or function to list, or a getter to run. */
type MetroHandle = object | MetroGetter;

const Logger = createLogger('Debugger', 'Metro');

// A tree a few levels deep holds a few hundred open objects; past this the least recently used refs go stale.
const CAPACITY = 1024;
// A Load All or search batch holds the JS thread this long at most, past the module it is on; Discord stays usable.
const BATCH_BUDGET_MS = 200;

// Modules Load All already ran, so one whose factory fails without joining the blacklist is not run each batch.
const attempted = new Set<number>();

/** The export owners a search built, kept while no module loads, since each batch of a search needs them. */
type OwnersCache = { loaded: number; owners: ExportOwners };

let ownersCache: OwnersCache | undefined;

function ownersOf(ids: readonly number[]): ExportOwners {
	if (ownersCache?.loaded !== ids.length) {
		ownersCache = { loaded: ids.length, owners: exportOwners(ids) };
	}

	return ownersCache.owners;
}

const metroObjects = createObjectRegistry<MetroHandle>({
	capacity: CAPACITY,
	// Each page load lists a getter again, and the same property keeps its ref.
	key: (handle) => (handle instanceof MetroGetter ? `${handle.owner}\0${handle.key}` : handle),
});

/** A request's optional paging fields. */
type PageRequest = { offset?: number; limit?: number };

function pageOf(request: PageRequest, size: number) {
	return {
		offset: Math.max(request.offset ?? 0, 0),
		limit: Math.min(Math.max(request.limit ?? size, 0), size),
	};
}

function moduleIds(): number[] {
	return [...window.modules.keys()];
}

function countLoaded(ids: readonly number[]): number {
	let loaded = 0;

	for (let i = 0, len = ids.length; i < len; i++) {
		if (moduleStatus(ids[i]) === 'loaded') {
			loaded++;
		}
	}

	return loaded;
}

function toModule(id: number): MetroModule {
	return { id, status: moduleStatus(id), label: moduleLabel(id) ?? null };
}

// UNKNOWN: a module's exports and their properties can be any value.
function toValue(key: string, value: unknown, internal = false): MetroValue {
	const { kind, text, expandable } = previewValue(value);
	const ref = expandable ? metroObjects.register(value as object) : void 0;

	return { key, kind, text, ...(ref && { ref }), ...(internal && { internal }) };
}

function readValue(key: string, read: InspectChild['read'], internal: boolean): MetroValue {
	try {
		return toValue(key, read(), internal);
	} catch (error) {
		const { kind, text } = errorPreview(error);

		return { key, kind, text, ...(internal && { internal }) };
	}
}

function childValue(owner: string, child: InspectChild): MetroValue {
	if (!child.getter) {
		return readValue(child.key, child.read, child.internal);
	}

	const ref = metroObjects.register(new MetroGetter(owner, child.key, child.read));

	return { key: child.key, kind: 'getter', text: '(…)', ref };
}

function listModules(request: MetroModulesRequest): MetroModulesResult {
	const ids = moduleIds();
	const matches = searchModules(ids, request.filter ?? '', request.status ?? 'all');
	const { offset, limit } = pageOf(request, METRO_MODULES_PAGE_SIZE);

	return {
		type: 'metro-modules-result',
		id: request.id,
		ok: true,
		modules: matches.slice(offset, offset + limit).map(toModule),
		total: matches.length,
		loaded: countLoaded(ids),
		count: ids.length,
	};
}

function isPending(id: number) {
	return moduleStatus(id) === 'unloaded' && !attempted.has(id);
}

function loadAll(request: MetroLoadAllRequest): MetroLoadAllResult {
	const ids = moduleIds();
	const started = Date.now();
	let ran = 0;
	let failed = 0;

	for (let i = 0, len = ids.length; i < len && Date.now() - started < BATCH_BUDGET_MS; i++) {
		const id = ids[i];

		if (!isPending(id)) {
			continue;
		}

		attempted.add(id);
		ran++;

		// `initializeModule` skips and adds to the blacklist itself, so a known-bad module never runs.
		if (!initializeModule(id) || moduleStatus(id) !== 'loaded') {
			failed++;
		}
	}

	return {
		type: 'metro-load-all-result',
		id: request.id,
		ok: true,
		attempted: ran,
		failed,
		remaining: ids.filter(isPending).length,
		loaded: countLoaded(ids),
		count: ids.length,
	};
}

function listFiles(request: MetroFilesRequest): MetroFilesResult {
	const ids = moduleIds();
	const files: MetroFile[] = [];
	let unloaded = 0;

	for (let i = 0, len = ids.length; i < len; i++) {
		const status = moduleStatus(ids[i]);
		const path = status === 'loaded' ? window.modules.get(ids[i])?.__filePath : void 0;

		if (status === 'unloaded') {
			unloaded++;
		} else if (path) {
			files.push({ id: ids[i], path });
		}
	}

	files.sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : a.id - b.id));

	return {
		type: 'metro-files-result',
		id: request.id,
		ok: true,
		files,
		unloaded,
		count: ids.length,
	};
}

function matchValue(match: KeyMatch): MetroValue {
	const { child, owner } = match;

	if (child.getter && owner) {
		return childValue(metroObjects.register(owner), child);
	}

	return readValue(child.key, child.read, child.internal);
}

function search(request: MetroSearchRequest): MetroSearchResult {
	const ids = moduleIds().filter((id) => moduleStatus(id) === 'loaded');
	const needle = request.query.trim().toLowerCase();
	const { offset, limit } = pageOf(
		{ offset: request.cursor, limit: request.limit },
		METRO_SEARCH_PAGE_SIZE,
	);
	const result = {
		type: 'metro-search-result',
		id: request.id,
		ok: true,
		total: ids.length,
	} as const;

	if (!needle) {
		return { ...result, matches: [], cursor: null, searched: ids.length };
	}

	const owners = ownersOf(ids);
	const started = Date.now();
	const matches: MetroMatch[] = [];
	let i = offset;

	// A batch stops at a module's end, so the cursor never splits one module's matches across answers.
	for (
		;
		i < ids.length && matches.length < limit && Date.now() - started < BATCH_BUDGET_MS;
		i++
	) {
		const id = ids[i];
		const module = toModule(id);

		for (const match of searchKeys(id, moduleExports(id), needle, owners, limit)) {
			matches.push({ module, path: match.path, value: matchValue(match) });
		}
	}

	return {
		...result,
		matches,
		cursor: i < ids.length ? i : null,
		searched: Math.min(i, ids.length),
	};
}

function resolveTarget({ target }: MetroChildrenRequest): MetroValue {
	if ('ref' in target) {
		const handle = metroObjects.resolve(target.ref);

		if (handle === undefined || handle instanceof MetroGetter) {
			throw new MetroFailure('stale', `Ref ${target.ref} is gone.`);
		}

		return toValue('', handle);
	}

	if (!window.modules.has(target.module)) {
		throw new MetroFailure('unknown-module', `No module ${target.module}.`);
	}

	if (moduleStatus(target.module) !== 'loaded') {
		throw new MetroFailure('unloaded', `Module ${target.module} has not loaded.`);
	}

	return toValue('module.exports', moduleExports(target.module));
}

function listTarget(request: MetroChildrenRequest): MetroChildrenResult {
	const value = resolveTarget(request);
	const handle = value.ref ? metroObjects.resolve(value.ref) : void 0;
	const result = { type: 'metro-children-result', id: request.id, ok: true, value } as const;

	if (!value.ref || !handle) {
		return { ...result, children: [], total: 0, internal: [] };
	}

	const owner = value.ref;
	const { offset, limit } = pageOf(request, METRO_CHILDREN_PAGE_SIZE);
	const { properties, total, internal } = listChildren(handle, offset, limit);

	return {
		...result,
		children: properties.map((child) => childValue(owner, child)),
		total,
		internal: internal.map((child) => childValue(owner, child)),
	};
}

function answer(request: MetroRequest): MetroResult {
	switch (request.type) {
		case 'metro-modules-request':
			return listModules(request);
		case 'metro-load-request': {
			if (!window.modules.has(request.module)) {
				throw new MetroFailure('unknown-module', `No module ${request.module}.`);
			}

			// A factory that throws blacklists its module, which then answers as `failed`.
			initializeModule(request.module);

			const module = toModule(request.module);

			return {
				type: 'metro-load-result',
				id: request.id,
				ok: true,
				module,
				loaded: countLoaded(moduleIds()),
			};
		}
		case 'metro-load-all-request':
			return loadAll(request);
		case 'metro-search-request':
			return search(request);
		case 'metro-files-request':
			return listFiles(request);
		case 'metro-children-request':
			return listTarget(request);
		case 'metro-read-request': {
			const getter = metroObjects.resolve(request.ref);

			if (!(getter instanceof MetroGetter)) {
				throw new MetroFailure('stale', `Ref ${request.ref} is not a getter.`);
			}

			const value = readValue(getter.key, getter.read, false);

			return { type: 'metro-read-result', id: request.id, ok: true, value };
		}
	}
}

/**
 * @description Answers a Metro explorer request; a failure answers with its code instead of throwing.
 * @param request The controller's request.
 * @returns The result frame to send back.
 */
export function answerMetro(request: MetroRequest): MetroResult {
	try {
		return answer(request);
	} catch (error) {
		if (error instanceof MetroFailure) {
			return failMetroRequest(request, error.message, error.code);
		}

		Logger.error(`Failed to answer ${request.type} ${request.id}:`, error);

		return failMetroRequest(request, errorPreview(error).text, 'failed');
	}
}

/** Drops every Metro ref, when the debugger disconnects or stops. */
export function resetMetro() {
	metroObjects.clear();
	attempted.clear();
	ownersCache = void 0;
}

export default { answerMetro, resetMetro };
