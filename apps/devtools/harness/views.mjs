// A spoofed native view tree, answered a page of one level at a time as `view-finder.dev.ts` does on
// a device. PLATFORM=ios swaps the Android tree for a UIKit one. Each tree has a grid wider than one
// page (VIEWS_PAGE_SIZE), so paging shows.
import { detailsOf } from './view-details.mjs';

const PAGE_SIZE = 100;
const GRID_ITEMS = 240;

function view(className, frame, options = {}, children = []) {
	return { className, frame, children, ...options };
}

const frame = (x, y, width, height) => ({ x, y, width, height });
const grid = (className, top, width) =>
	Array.from({ length: GRID_ITEMS }, (_, index) =>
		view(
			className,
			frame((index % 8) * (width / 8), top + Math.floor(index / 8) * 48, width / 8, 48),
			{
				resourceName: index % 8 === 0 ? `emoji_row_${index / 8}` : undefined,
			},
		),
	);

const ANDROID_CHAT = 'com.discord.chat.presentation';
const RN = 'com.facebook.react.views';

function message(y, author, content) {
	const text = `${ANDROID_CHAT}.text.ChatTextView`;

	return view(`${ANDROID_CHAT}.message.MessageView`, frame(0, y, 411, 72), {}, [
		view('com.facebook.drawee.view.SimpleDraweeView', frame(16, y + 8, 40, 40), {
			resourceName: 'message_avatar',
		}),
		view(`${ANDROID_CHAT}.message.view.MessageHeaderView`, frame(72, y + 8, 323, 20), {}, [
			view(text, frame(72, y + 8, 120, 20), { resourceName: 'message_author', text: author }),
			view(text, frame(200, y + 10, 80, 16), {
				resourceName: 'message_timestamp',
				text: 'Today at 21:04',
				alpha: 0.6,
			}),
		]),
		view(text, frame(72, y + 30, 323, 36), { resourceName: 'message_content', text: content }),
	]);
}

const ANDROID = view('com.android.internal.policy.DecorView', frame(0, 0, 411, 914), {}, [
	view('android.widget.LinearLayout', frame(0, 0, 411, 914), {}, [
		view('android.widget.FrameLayout', frame(0, 24, 411, 866), { resourceName: 'content' }, [
			view('com.facebook.react.ReactRootView', frame(0, 24, 411, 866), {}, [
				view(`${RN}.view.ReactViewGroup`, frame(0, 24, 411, 866), {}, [
					view(`${RN}.view.ReactViewGroup`, frame(0, 24, 411, 56), {}, [
						view(`${RN}.image.ReactImageView`, frame(16, 40, 24, 24)),
						view(`${RN}.text.ReactTextView`, frame(48, 38, 200, 28), {
							text: '# general',
						}),
						view(`${RN}.view.ReactViewGroup`, frame(363, 36, 32, 32), {
							visibility: 'invisible',
						}),
					]),
					view(
						`${ANDROID_CHAT}.list.ChatListView`,
						frame(0, 80, 411, 420),
						{ resourceName: 'chat_list' },
						[
							message(80, 'user0', 'hello 0'),
							message(152, 'user1', 'has anyone tried the new icon pack?'),
							message(224, 'user2', 'works on my machine'),
							view(`${ANDROID_CHAT}.message.MessageView`, frame(0, 296, 411, 0), {
								visibility: 'gone',
							}),
						],
					),
					view(
						`${RN}.view.ReactViewGroup`,
						frame(0, 500, 411, 310),
						{ resourceName: 'emoji_picker' },
						grid(`${RN}.image.ReactImageView`, 500, 411),
					),
					view(`${RN}.view.ReactViewGroup`, frame(0, 810, 411, 80), {}, [
						view(`${RN}.textinput.ReactEditText`, frame(16, 822, 331, 48), {
							text: 'Message #general',
							alpha: 0.5,
						}),
						view(`${RN}.view.ReactViewGroup`, frame(355, 826, 40, 40)),
					]),
				]),
			]),
		]),
	]),
	view('android.view.View', frame(0, 0, 411, 24), { resourceName: 'statusBarBackground' }),
	view('android.view.View', frame(0, 890, 411, 24), { resourceName: 'navigationBarBackground' }),
]);

function cell(y, author, content) {
	return view('DCDMessageTableViewCell', frame(0, y, 390, 72), {}, [
		view('UITableViewCellContentView', frame(0, y, 390, 72), {}, [
			view('DCDAvatarView', frame(16, y + 8, 40, 40), { resourceName: 'avatar' }),
			view('DCDMessageHeaderView', frame(72, y + 8, 302, 20), {}, [
				view('UILabel', frame(72, y + 8, 120, 20), { text: author }),
				view('UILabel', frame(200, y + 10, 80, 16), { text: 'Today at 21:04', alpha: 0.6 }),
			]),
			view('DCDTextView', frame(72, y + 30, 302, 36), { text: content }),
		]),
	]);
}

const IOS = view('UIWindow', frame(0, 0, 390, 844), {}, [
	view('UITransitionView', frame(0, 0, 390, 844), {}, [
		view('UIDropShadowView', frame(0, 0, 390, 844), {}, [
			view('RCTRootView', frame(0, 0, 390, 844), {}, [
				view('RCTSurfaceHostingProxyRootView', frame(0, 0, 390, 844), {}, [
					view('RCTViewComponentView', frame(0, 47, 390, 56), {}, [
						view('RCTParagraphComponentView', frame(48, 61, 200, 28), {
							text: '# general',
						}),
					]),
					view(
						'DCDChatTableView',
						frame(0, 103, 390, 340),
						{ resourceName: 'chat_list' },
						[
							cell(103, 'user0', 'hello 0'),
							cell(175, 'user1', 'has anyone tried the new icon pack?'),
							cell(247, 'user2', 'works on my machine'),
						],
					),
					view(
						'UICollectionView',
						frame(0, 443, 390, 317),
						{ resourceName: 'emoji_picker' },
						grid('UIImageView', 443, 390),
					),
					view('RCTViewComponentView', frame(0, 760, 390, 84), {}, [
						view('RCTUITextView', frame(16, 772, 310, 44), {
							text: 'Message #general',
							alpha: 0.5,
						}),
					]),
				]),
			]),
		]),
	]),
]);

export const platform = process.env.PLATFORM === 'ios' ? 'ios' : 'android';

const ROOT = platform === 'ios' ? IOS : ANDROID;
const listed = new Map();
let ids = new WeakMap();
let nextId = 0;

function describe(node) {
	let id = ids.get(node);

	if (!id) {
		id = String(++nextId);
		ids.set(node, id);
	}

	listed.set(id, node);

	return {
		id,
		className: node.className,
		resourceName: node.resourceName ?? null,
		frame: node.frame,
		visibility: node.visibility ?? 'visible',
		alpha: node.alpha ?? 1,
		text: node.text ?? null,
		childCount: node.children.length,
	};
}

/**
 * A listed view by its id, as `explorer.mjs` opens one.
 * @param {string} id
 */
export function listedView(id) {
	return listed.get(id);
}

const failure = (type, id, error) => ({ type, id, ok: false, error });

/**
 * Answers a `views-request`: a page of the roots, which renews every id, or of one listed view's children.
 * @param {{ id: string, parent?: string, offset?: number, limit?: number }} request
 */
export function answerViews(request) {
	const offset = request.offset ?? 0;
	const limit = Math.min(request.limit ?? PAGE_SIZE, PAGE_SIZE);

	if (request.parent === undefined) {
		listed.clear();
		ids = new WeakMap();
	}

	const level = request.parent === undefined ? [ROOT] : listed.get(request.parent)?.children;

	if (!level) {
		return failure(
			'views-result',
			request.id,
			`Failed to find view ${request.parent}; refresh the tree.`,
		);
	}

	const nodes = level.slice(offset, offset + limit).map(describe);

	return { type: 'views-result', id: request.id, ok: true, nodes, total: level.length };
}

/**
 * Answers a `view-details-request` with a class chain and properties made up from the listed view.
 * @param {{ id: string, node: string }} request
 */
export function answerDetails(request) {
	const node = listed.get(request.node);

	if (!node) {
		return failure(
			'view-details-result',
			request.id,
			`Failed to find view ${request.node}; refresh the tree.`,
		);
	}

	return {
		type: 'view-details-result',
		id: request.id,
		ok: true,
		details: detailsOf(node, platform),
	};
}
