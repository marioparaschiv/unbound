/**
 * The Metro explorer's frames: list, load and search modules, and walk a loaded module's exports as a tree. Long
 * work runs in short device-side batches the controller repeats; getters run only when asked.
 */

/** The most modules a device returns for one {@link MetroModulesRequest}. */
export const METRO_MODULES_PAGE_SIZE = 200;
/** The most properties a device returns for one {@link MetroChildrenRequest}. */
export const METRO_CHILDREN_PAGE_SIZE = 100;
/** The most matches a device collects for one {@link MetroSearchRequest} before it stops at a module's end. */
export const METRO_SEARCH_PAGE_SIZE = 50;

/** Whether a module's factory has run: `failed` when it threw, or searches skip it before it ran. */
export type MetroModuleStatus = 'loaded' | 'unloaded' | 'failed';

/** One Metro module. */
export type MetroModule = {
	id: number;
	status: MetroModuleStatus;
	/** A loaded module's file path, else its first export names; `null` before it loads or when it exports none. */
	label: string | null;
};

/** What a value is, which picks its colour; `getter` is an accessor that has not run. */
export type MetroValueKind =
	| 'string'
	| 'number'
	| 'boolean'
	| 'nullish'
	| 'symbol'
	| 'function'
	| 'class'
	| 'array'
	| 'object'
	| 'error'
	| 'getter';

/** One value in the tree: a module's exports, a property, or a slot such as `[[Prototype]]`. */
export type MetroValue = {
	key: string;
	kind: MetroValueKind;
	text: string;
	/**
	 * The ref that lists the value's children, or that runs a getter. The same object always has the same ref, so a
	 * controller can tell a value that is already open above itself.
	 */
	ref?: string;
	/** An engine slot such as `[[Prototype]]` or `[[Entries]]` rather than a property. */
	internal?: boolean;
};

/** What to list the children of: a loaded module's exports, or a value the device handed out a ref for. */
export type MetroTarget = { module: number } | { ref: string };

/** Why a Metro request failed. */
export type MetroErrorCode =
	/** The ref is gone, such as after a JavaScript reload. */
	| 'stale'
	| 'unknown-module'
	/** The module has not loaded, so it has no exports to list. */
	| 'unloaded'
	| 'failed';

/** A failed Metro answer. */
export type MetroError = {
	ok: false;
	error: string;
	code: MetroErrorCode;
};

/** Controller → bridge → device: list a page of the modules matching a filter and a status. */
export type MetroModulesRequest = {
	type: 'metro-modules-request';
	/** Correlation id echoed back on the matching {@link MetroModulesResult}. */
	id: string;
	/** A case-insensitive id prefix or substring of a module's label. */
	filter?: string;
	/** The status to keep; every module when omitted. */
	status?: MetroModuleStatus;
	offset?: number;
	/** At most {@link METRO_MODULES_PAGE_SIZE}, which is also the default. */
	limit?: number;
};

/** The answer to a {@link MetroModulesRequest}. */
export type MetroModulesResult = {
	type: 'metro-modules-result';
	id: string;
} & (
	| {
			ok: true;
			modules: MetroModule[];
			/** How many modules match. */
			total: number;
			/** How many modules have loaded, of `count`. */
			loaded: number;
			/** How many modules the registry holds. */
			count: number;
	  }
	| MetroError
);

/** Controller → bridge → device: run a module's factory, and those of the modules it requires. */
export type MetroLoadRequest = {
	type: 'metro-load-request';
	id: string;
	module: number;
};

/** The answer to a {@link MetroLoadRequest}: the module afterwards, `failed` when its factory threw. */
export type MetroLoadResult = {
	type: 'metro-load-result';
	id: string;
} & ({ ok: true; module: MetroModule; loaded: number } | MetroError);

/**
 * Controller → bridge → device: load the next batch of modules that have not loaded, skipping the blacklist of
 * modules that threw or export something invalid. The controller repeats it until `remaining` is 0.
 */
export type MetroLoadAllRequest = {
	type: 'metro-load-all-request';
	id: string;
};

/** The answer to a {@link MetroLoadAllRequest}: what the batch did and what is left. */
export type MetroLoadAllResult = {
	type: 'metro-load-all-result';
	id: string;
} & (
	| {
			ok: true;
			/** How many modules this batch ran. */
			attempted: number;
			/** How many of those threw, and joined the blacklist. */
			failed: number;
			/** How many modules are still to run; 0 when Load All is done. */
			remaining: number;
			loaded: number;
			count: number;
	  }
	| MetroError
);

/** One key a search matched: the module, the keys from its exports down to it, and its value. */
export type MetroMatch = {
	module: MetroModule;
	/** Property keys, or `[[Prototype]]`, from the exports; empty when the exports themselves match. */
	path: string[];
	value: MetroValue;
};

/**
 * Controller → bridge → device: find keys containing `query` under the loaded modules' exports and prototypes,
 * without running getters, for one batch; the answer's `cursor` continues it.
 */
export type MetroSearchRequest = {
	type: 'metro-search-request';
	id: string;
	/** Case-insensitive text a key or function name contains. */
	query: string;
	/** The loaded module to start from, as an index; the previous answer's `cursor`. */
	cursor?: number;
	/** At most {@link METRO_SEARCH_PAGE_SIZE}, which is also the default. */
	limit?: number;
};

/** The answer to a {@link MetroSearchRequest}. */
export type MetroSearchResult = {
	type: 'metro-search-result';
	id: string;
} & (
	| {
			ok: true;
			matches: MetroMatch[];
			/** Where the next request continues, or `null` once every loaded module is searched. */
			cursor: number | null;
			/** How many loaded modules are searched so far, of `total`. */
			searched: number;
			total: number;
	  }
	| MetroError
);

/** A loaded module that reported the source file it was built from. */
export type MetroFile = {
	id: number;
	/** The path Discord's import tracker reported, such as `modules/user_profile/native/UserProfileStore.tsx`. */
	path: string;
};

/**
 * Controller → bridge → device: list every loaded module's file path, for a file tree. A module reports its path
 * only as it loads, so the tree is complete once every module has loaded.
 */
export type MetroFilesRequest = {
	type: 'metro-files-request';
	id: string;
};

/** The answer to a {@link MetroFilesRequest}, sorted by path. */
export type MetroFilesResult = {
	type: 'metro-files-result';
	id: string;
} & (
	| {
			ok: true;
			files: MetroFile[];
			/** How many modules have not loaded, whose paths are not known yet. */
			unloaded: number;
			count: number;
	  }
	| MetroError
);

/** Controller → bridge → device: describe a value and list a page of its children. */
export type MetroChildrenRequest = {
	type: 'metro-children-request';
	id: string;
	target: MetroTarget;
	offset?: number;
	/** At most {@link METRO_CHILDREN_PAGE_SIZE}, which is also the default. */
	limit?: number;
};

/** The answer to a {@link MetroChildrenRequest}. */
export type MetroChildrenResult = {
	type: 'metro-children-result';
	id: string;
} & (
	| {
			ok: true;
			/** The target itself. */
			value: MetroValue;
			/** A page of its own properties. */
			children: MetroValue[];
			/** How many own properties it has. */
			total: number;
			/** Its slots, listed after the properties: `[[Entries]]`, `[[Prototype]]`. */
			internal: MetroValue[];
	  }
	| MetroError
);

/** Controller → bridge → device: run the getter a `getter` value's ref stands for. */
export type MetroReadRequest = {
	type: 'metro-read-request';
	id: string;
	ref: string;
};

/** The answer to a {@link MetroReadRequest}: the getter's result, or an `error` value for what it threw. */
export type MetroReadResult = {
	type: 'metro-read-result';
	id: string;
} & ({ ok: true; value: MetroValue } | MetroError);

export type MetroRequest =
	| MetroModulesRequest
	| MetroLoadRequest
	| MetroLoadAllRequest
	| MetroSearchRequest
	| MetroFilesRequest
	| MetroChildrenRequest
	| MetroReadRequest;

export type MetroResult =
	| MetroModulesResult
	| MetroLoadResult
	| MetroLoadAllResult
	| MetroSearchResult
	| MetroFilesResult
	| MetroChildrenResult
	| MetroReadResult;

/** The result frame type answering each request frame type. */
export const METRO_RESULT_TYPES = {
	'metro-modules-request': 'metro-modules-result',
	'metro-load-request': 'metro-load-result',
	'metro-load-all-request': 'metro-load-all-result',
	'metro-search-request': 'metro-search-result',
	'metro-files-request': 'metro-files-result',
	'metro-children-request': 'metro-children-result',
	'metro-read-request': 'metro-read-result',
} as const satisfies Record<MetroRequest['type'], MetroResult['type']>;

const STATUSES: ReadonlySet<unknown> = new Set<MetroModuleStatus>(['loaded', 'unloaded', 'failed']);
const VALUE_KINDS: ReadonlySet<unknown> = new Set<MetroValueKind>([
	'string',
	'number',
	'boolean',
	'nullish',
	'symbol',
	'function',
	'class',
	'array',
	'object',
	'error',
	'getter',
]);
const ERROR_CODES: ReadonlySet<unknown> = new Set<MetroErrorCode>([
	'stale',
	'unknown-module',
	'unloaded',
	'failed',
]);

/** A frame narrowed to its type, before its other fields are checked. */
type TypedFrame = { type: string };

/** A value parsed off the wire, before it is checked. */
type WireValue = string | number | boolean | null | undefined | WireValue[] | WireRecord;

/** An object parsed off the wire, before its fields are checked. */
type WireRecord = { [key: string]: WireValue };

/**
 * @description Builds the failed answer to a Metro request.
 * @param request The request, or its type and id.
 * @param error What failed.
 * @param code Why it failed.
 * @returns The result frame.
 */
export function failMetroRequest(
	request: Pick<MetroRequest, 'type' | 'id'>,
	error: string,
	code: MetroErrorCode,
): MetroResult {
	return { type: METRO_RESULT_TYPES[request.type], id: request.id, ok: false, error, code };
}

/**
 * @description Checks whether a frame is a Metro request, by its type alone.
 * @param frame A parsed frame.
 * @returns Whether it is one.
 */
export function isMetroRequest(frame: TypedFrame): frame is MetroRequest {
	return Object.hasOwn(METRO_RESULT_TYPES, frame.type);
}

/**
 * @description Checks whether a frame is a Metro result, by its type alone.
 * @param frame A parsed frame.
 * @returns Whether it is one.
 */
export function isMetroResult(frame: TypedFrame): frame is MetroResult {
	return Object.values<string>(METRO_RESULT_TYPES).includes(frame.type);
}

function isObject(value: unknown): value is WireRecord {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isCount(value: unknown): value is number {
	return typeof value === 'number' && Number.isInteger(value) && value >= 0;
}

/** Checks an optional field: absent, `undefined`, or passing `check`. */
function optional(record: WireRecord, key: string, check: (value: WireValue) => boolean) {
	return record[key] === undefined || check(record[key]);
}

const isString = (value: WireValue): value is string => typeof value === 'string';

function isTarget(value: unknown): value is MetroTarget {
	if (!isObject(value)) {
		return false;
	}

	const keys = ['module', 'ref'].filter((key) => value[key] !== undefined);

	return (
		keys.length === 1 && (keys[0] === 'module' ? isCount(value.module) : isString(value.ref))
	);
}

function isMetroModule(value: unknown): value is MetroModule {
	return (
		isObject(value) &&
		isCount(value.id) &&
		STATUSES.has(value.status) &&
		(value.label === null || typeof value.label === 'string')
	);
}

function isMetroValue(value: unknown): value is MetroValue {
	return (
		isObject(value) &&
		typeof value.key === 'string' &&
		VALUE_KINDS.has(value.kind) &&
		typeof value.text === 'string' &&
		optional(value, 'ref', isString) &&
		optional(value, 'internal', (flag) => typeof flag === 'boolean')
	);
}

const isMetroValues = (value: WireValue) => Array.isArray(value) && value.every(isMetroValue);

function isMetroFile(value: unknown): value is MetroFile {
	return isObject(value) && isCount(value.id) && isString(value.path);
}

function isMetroMatch(value: unknown): value is MetroMatch {
	return (
		isObject(value) &&
		isMetroModule(value.module) &&
		Array.isArray(value.path) &&
		value.path.every(isString) &&
		isMetroValue(value.value)
	);
}

/** Checks a result's id and outcome; `isOk` checks the payload of a successful one. */
function isResult(frame: WireRecord, isOk: () => boolean): boolean {
	if (typeof frame.id !== 'string') {
		return false;
	}

	if (frame.ok === true) {
		return isOk();
	}

	return frame.ok === false && typeof frame.error === 'string' && ERROR_CODES.has(frame.code);
}

/**
 * @description Checks the fields of a Metro frame whose `type` is already known.
 * @param frame The parsed frame.
 * @returns Whether the frame is a valid Metro request or result.
 */
export function isMetroFrame(frame: unknown): frame is MetroRequest | MetroResult {
	if (!isObject(frame)) {
		return false;
	}

	switch (frame.type) {
		case 'metro-modules-request':
			return (
				typeof frame.id === 'string' &&
				optional(frame, 'filter', isString) &&
				optional(frame, 'status', (status) => STATUSES.has(status)) &&
				optional(frame, 'offset', isCount) &&
				optional(frame, 'limit', isCount)
			);
		case 'metro-modules-result':
			return isResult(
				frame,
				() =>
					isCount(frame.total) &&
					isCount(frame.loaded) &&
					isCount(frame.count) &&
					Array.isArray(frame.modules) &&
					frame.modules.every(isMetroModule),
			);
		case 'metro-load-request':
			return typeof frame.id === 'string' && isCount(frame.module);
		case 'metro-load-result':
			return isResult(frame, () => isMetroModule(frame.module) && isCount(frame.loaded));
		case 'metro-load-all-request':
			return typeof frame.id === 'string';
		case 'metro-load-all-result':
			return isResult(frame, () =>
				[frame.attempted, frame.failed, frame.remaining, frame.loaded, frame.count].every(
					isCount,
				),
			);
		case 'metro-search-request':
			return (
				typeof frame.id === 'string' &&
				isString(frame.query) &&
				optional(frame, 'cursor', isCount) &&
				optional(frame, 'limit', isCount)
			);
		case 'metro-search-result':
			return isResult(
				frame,
				() =>
					Array.isArray(frame.matches) &&
					frame.matches.every(isMetroMatch) &&
					(frame.cursor === null || isCount(frame.cursor)) &&
					isCount(frame.searched) &&
					isCount(frame.total),
			);
		case 'metro-files-request':
			return typeof frame.id === 'string';
		case 'metro-files-result':
			return isResult(
				frame,
				() =>
					Array.isArray(frame.files) &&
					frame.files.every(isMetroFile) &&
					isCount(frame.unloaded) &&
					isCount(frame.count),
			);
		case 'metro-children-request':
			return (
				typeof frame.id === 'string' &&
				isTarget(frame.target) &&
				optional(frame, 'offset', isCount) &&
				optional(frame, 'limit', isCount)
			);
		case 'metro-children-result':
			return isResult(
				frame,
				() =>
					isMetroValue(frame.value) &&
					isCount(frame.total) &&
					isMetroValues(frame.children) &&
					isMetroValues(frame.internal),
			);
		case 'metro-read-request':
			return typeof frame.id === 'string' && typeof frame.ref === 'string';
		case 'metro-read-result':
			return isResult(frame, () => isMetroValue(frame.value));
		default:
			return false;
	}
}
