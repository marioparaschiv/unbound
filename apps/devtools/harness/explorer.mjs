// Spoofed Native Object Explorer answers for `device.mjs`: the four `explorer-*-request` frames, as
// the client's explorer answers them on a device. PLATFORM=ios reads Objective-C classes from
// `explorer-ios.mjs`, otherwise Java classes from `explorer-android.mjs`. `dead:1` answers `stale`,
// `DisabledProbe` answers `disabled`, and Android has no class list (`unsupported`).
import { ExplorerFailure, KINDS, chainOf, classNamed, ios } from './explorer-classes.mjs';
import { IOS_IMAGES } from './explorer-ios.mjs';
import { answerValues, describe, nodeObject, objectOf } from './explorer-objects.mjs';
import { platform } from './views.mjs';

const MEMBERS_PAGE_SIZE = 100;
const CLASSES_PAGE_SIZE = 200;

function answerObject({ target }) {
	if (target.className !== undefined) {
		const chain = chainOf(target.className);

		return {
			object: { ref: null, className: target.className, description: null, platform, chain },
		};
	}

	const object = target.node !== undefined ? nodeObject(target.node) : objectOf(target.object);

	return {
		object: {
			ref: object.ref,
			className: object.className,
			description: describe(object),
			platform,
			chain: chainOf(object.className),
		},
	};
}

function page(items, { offset = 0, limit, filter }, size) {
	const needle = filter?.toLowerCase();
	const matches = needle
		? items.filter((item) => (item.name ?? item).toLowerCase().includes(needle))
		: items;

	return {
		total: matches.length,
		items: matches.slice(offset, offset + Math.min(limit ?? size, size)),
	};
}

function answerMembers(request) {
	if (!KINDS.includes(request.kind)) {
		throw new ExplorerFailure(
			'failed',
			`Failed to list ${request.kind}: not a ${platform} member kind.`,
		);
	}

	const members = classNamed(request.className).members[request.kind] ?? [];
	const { total, items } = page(members, request, MEMBERS_PAGE_SIZE);

	return { members: items, total };
}

function answerClasses(request) {
	if (!ios) {
		throw new ExplorerFailure(
			'unsupported',
			'Android has no class list; open a class by name.',
		);
	}

	if (request.image === undefined) {
		const images = IOS_IMAGES.map(({ path, name, classCount }) => ({ path, name, classCount }));
		const { total, items } = page(images, request, CLASSES_PAGE_SIZE);

		return { total, images: items };
	}

	const image = IOS_IMAGES.find(({ path }) => path === request.image);
	if (!image) throw new ExplorerFailure('failed', `Failed to find image ${request.image}.`);

	const { total, items } = page(image.classes, request, CLASSES_PAGE_SIZE);

	return { total, classes: items };
}

const ANSWERS = {
	'explorer-object-request': answerObject,
	'explorer-members-request': answerMembers,
	'explorer-values-request': answerValues,
	'explorer-classes-request': answerClasses,
};

/**
 * Answers an `explorer-*-request` with its `explorer-*-result`; undefined for any other frame.
 * @param {{ type: string, id: string }} request
 */
export function answerExplorer(request) {
	const answer = ANSWERS[request.type];
	if (!answer) return undefined;

	const type = request.type.replace(/-request$/, '-result');

	try {
		return { type, id: request.id, ok: true, ...answer(request) };
	} catch (error) {
		if (!(error instanceof ExplorerFailure)) throw error;

		return { type, id: request.id, ok: false, error: error.message, code: error.code };
	}
}
