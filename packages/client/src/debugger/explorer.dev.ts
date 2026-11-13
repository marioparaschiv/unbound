import type {
	ExplorerClassesRequest,
	ExplorerClassesResult,
	ExplorerImage,
	ExplorerMember,
	ExplorerMemberKind,
	ExplorerObject,
	ExplorerRequest,
	ExplorerResult,
	ExplorerTarget,
	ExplorerValue,
	ExplorerValuesRequest,
} from '@unbound-app/debugger-protocol';
import {
	EXPLORER_CLASSES_PAGE_SIZE,
	EXPLORER_MEMBERS_PAGE_SIZE,
	EXPLORER_VALUES_LIMIT,
	failExplorerRequest,
} from '@unbound-app/debugger-protocol';
import { createLogger } from '@unbound-app/logger';

import {
	explorerObjects,
	type ExplorerHandle,
	type ObjectRegistry,
} from '~/debugger/explorer-objects.dev';
import { explorerError, explorerFailure } from '~/debugger/explorer-errors.dev';
import { createAndroidExplorer } from '~/debugger/explorer-android.dev';
import { createIosExplorer } from '~/debugger/explorer-ios.dev';
import { viewHandle } from '~/debugger/view-finder.dev';
import { currentPlatform } from '~/native/platform';
import { getNativeBridge } from '~/native/bridge';

/** One page of a list, from `offset`, at most `limit` long, its names containing `filter` when set. */
export type ExplorerPage = { offset: number; limit: number; filter?: string };

/** One page of members and how many match in all. */
export type MemberPage = { members: ExplorerMember[]; total: number };

/** One page of images or of an image's classes, and how many match in all. */
export type ClassPage = { total: number; images?: ExplorerImage[]; classes?: string[] };

/** What a source reads objects through: the explorer's refs, and the View Tree's handle for a listed view. */
export type ExplorerContext = {
	objects: ObjectRegistry<ExplorerHandle>;
	nodeHandle: (node: string) => ExplorerHandle | undefined;
};

/** One platform's reflection over native objects and classes. Each method throws an {@link explorerError}. */
export type ExplorerSource = {
	object(target: ExplorerTarget): Promise<ExplorerObject>;
	members(className: string, kind: ExplorerMemberKind, page: ExplorerPage): Promise<MemberPage>;
	values(request: ExplorerValuesRequest): Promise<ExplorerValue[]>;
	classes(image: string | undefined, page: ExplorerPage): Promise<ClassPage>;
};

const Logger = createLogger('Debugger', 'Explorer');

let source: ExplorerSource | undefined;

function resolveSource(): ExplorerSource {
	if (source) {
		return source;
	}

	const bridge = getNativeBridge();
	const platform = currentPlatform();
	const context: ExplorerContext = { objects: explorerObjects, nodeHandle: viewHandle };

	if (platform === 'android' && bridge?.java) {
		source = createAndroidExplorer(bridge.java, context);
	} else if (platform === 'ios' && bridge?.objc) {
		source = createIosExplorer(bridge.objc, context);
	} else {
		throw explorerError(
			'unsupported',
			`The loader has no native object access on ${platform ?? 'this platform'}.`,
		);
	}

	return source;
}

/** A request's optional paging fields. */
type PageRequest = { offset?: number; limit?: number; filter?: string };

function pageOf(request: PageRequest, size: number): ExplorerPage {
	return {
		offset: Math.max(request.offset ?? 0, 0),
		limit: Math.min(Math.max(request.limit ?? size, 0), size),
		filter: request.filter || undefined,
	};
}

async function readValues(request: ExplorerValuesRequest): Promise<ExplorerValue[]> {
	if (request.names.length > EXPLORER_VALUES_LIMIT) {
		throw explorerError(
			'failed',
			`Read at most ${EXPLORER_VALUES_LIMIT} values at once, not ${request.names.length}.`,
		);
	}

	return request.names.length ? await resolveSource().values(request) : [];
}

async function listClasses(request: ExplorerClassesRequest): Promise<ExplorerClassesResult> {
	const page = await resolveSource().classes(
		request.image,
		pageOf(request, EXPLORER_CLASSES_PAGE_SIZE),
	);

	return { type: 'explorer-classes-result', id: request.id, ok: true, ...page };
}

async function answer(request: ExplorerRequest): Promise<ExplorerResult> {
	switch (request.type) {
		case 'explorer-object-request': {
			const object = await resolveSource().object(request.target);

			return { type: 'explorer-object-result', id: request.id, ok: true, object };
		}
		case 'explorer-members-request': {
			const page = pageOf(request, EXPLORER_MEMBERS_PAGE_SIZE);
			const { members, total } = await resolveSource().members(
				request.className,
				request.kind,
				page,
			);

			return { type: 'explorer-members-result', id: request.id, ok: true, members, total };
		}
		case 'explorer-values-request': {
			const values = await readValues(request);

			return { type: 'explorer-values-result', id: request.id, ok: true, values };
		}
		case 'explorer-classes-request':
			return await listClasses(request);
	}
}

/**
 * @description Answers an object explorer request; a failure answers with its code instead of throwing.
 * @param request The controller's request.
 * @returns The result frame to send back.
 */
export async function answerExplorer(request: ExplorerRequest): Promise<ExplorerResult> {
	try {
		return await answer(request);
	} catch (error) {
		const { error: message, code } = explorerFailure(error);

		if (code === 'failed') {
			Logger.error(`Failed to answer ${request.type} ${request.id}:`, error);
		}

		return failExplorerRequest(request, message, code);
	}
}

/** Drops every explorer ref and cached class, when the debugger disconnects or stops. */
export function resetExplorer() {
	explorerObjects.clear();
	source = undefined;
}

export default { answerExplorer, resetExplorer };
