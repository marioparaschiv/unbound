import type {
	NativeFabricFrame as Frame,
	NativeObjCBridge,
	NativeObjectHandle,
} from '@unbound-app/api/native';
import { safeInvokeAsync } from '@unbound-plugins/shared/native/safe-invoke';
import { viewKey } from '@unbound-plugins/shared/native/view-key';

import { headerLayout, type Placed, type Placement } from '~/header-layout';
import { LAYOUT_RELATION_EQUAL, LayoutAttribute } from '~/constants';
import { getFrame, getSubviews, setFrame } from '~/native/views';

type SavedView = {
	view: NativeObjectHandle;
	frame: Frame;
	translates: boolean;
};

type AddedConstraint = {
	container: NativeObjectHandle;
	constraint: NativeObjectHandle;
};

/** What `installLayout` changed, so `restoreLayout` can put it back. */
export type Layout = {
	views: SavedView[];
	constraints: AddedConstraint[];
};

type Spec = [
	item: NativeObjectHandle,
	attribute: number,
	toItem: NativeObjectHandle | null,
	toAttribute: number,
	constant: number,
];

function specs({ view, leading, centerY, width, height }: Placement<NativeObjectHandle>): Spec[] {
	const [anchor, edge, offset] = leading;
	const edgeAttribute = edge === 'leading' ? LayoutAttribute.Leading : LayoutAttribute.Trailing;

	return [
		[view, LayoutAttribute.Leading, anchor, edgeAttribute, offset],
		[view, LayoutAttribute.CenterY, centerY[0], LayoutAttribute.CenterY, centerY[1]],
		[view, LayoutAttribute.Width, null, LayoutAttribute.NotAnAttribute, width],
		[view, LayoutAttribute.Height, null, LayoutAttribute.NotAnAttribute, height],
	];
}

async function constrain(
	objc: NativeObjCBridge,
	container: NativeObjectHandle,
	placements: Placement<NativeObjectHandle>[],
	layout: Layout,
) {
	const NSLayoutConstraint = objc.getClass('NSLayoutConstraint');

	if (!NSLayoutConstraint) throw new Error('NSLayoutConstraint is unavailable');

	for (const [item, attribute, toItem, toAttribute, constant] of placements.flatMap(specs)) {
		const constraint = (await objc.invokeAsync(
			NSLayoutConstraint,
			'constraintWithItem:attribute:relatedBy:toItem:attribute:multiplier:constant:',
			[item, attribute, LAYOUT_RELATION_EQUAL, toItem, toAttribute, 1, constant],
		)) as NativeObjectHandle | null;

		if (!constraint) throw new Error('Failed to create message latency layout constraint');

		await objc.invokeAsync(container, 'addConstraint:', [constraint]);
		layout.constraints.push({ container, constraint });
	}
}

async function placed(objc: NativeObjCBridge, views: NativeObjectHandle[]): Promise<MaybePlaced[]> {
	return Promise.all(views.map(async (view) => ({ view, frame: await getFrame(objc, view) })));
}

type MaybePlaced = {
	view: NativeObjectHandle;
	frame: Frame | null;
};

function hasFrame(entry: MaybePlaced): entry is Placed<NativeObjectHandle> {
	return entry.frame !== null && entry.frame.width > 0;
}

async function save(objc: NativeObjCBridge, view: NativeObjectHandle): Promise<SavedView> {
	const frame = await getFrame(objc, view);

	if (!frame) throw new Error('Failed to read message latency layout frame');

	const translates = await safeInvokeAsync(
		objc,
		view,
		'translatesAutoresizingMaskIntoConstraints',
	);

	return { view, frame, translates: Boolean(translates) };
}

/**
 * @description Puts back every frame and constraint `installLayout` changed.
 * @param objc The Objective-C bridge from `context.native`.
 * @param layout The layout `installLayout` returned.
 */
export async function restoreLayout(objc: NativeObjCBridge, layout: Layout): Promise<void> {
	for (const { container, constraint } of layout.constraints) {
		await safeInvokeAsync(objc, container, 'removeConstraint:', constraint);
	}

	for (const { view, frame, translates } of layout.views) {
		await setFrame(objc, view, frame);
		await safeInvokeAsync(
			objc,
			view,
			'setTranslatesAutoresizingMaskIntoConstraints:',
			translates,
		);
	}
}

/**
 * @description Inserts the icon before the username in a message header, moving the name group and timestamp with Auto Layout.
 * @param objc The Objective-C bridge from `context.native`.
 * @param icon The icon from `createIcon`.
 * @param label The username label.
 * @param row The header row that holds the name group and timestamp.
 * @returns What was changed, for `restoreLayout`.
 * @throws When the header does not have the expected native layout. Nothing is left changed.
 */
export async function installLayout(
	objc: NativeObjCBridge,
	icon: NativeObjectHandle,
	label: NativeObjectHandle,
	row: NativeObjectHandle,
): Promise<Layout> {
	const username = (await safeInvokeAsync(objc, label, 'superview')) as NativeObjectHandle | null;
	const group = username
		? ((await safeInvokeAsync(objc, username, 'superview')) as NativeObjectHandle | null)
		: null;
	const groupRow = group
		? ((await safeInvokeAsync(objc, group, 'superview')) as NativeObjectHandle | null)
		: null;

	if (!username || !group || !groupRow || viewKey(objc, groupRow) !== viewKey(objc, row)) {
		throw new Error('Message latency username row has an unsupported native layout');
	}

	const [groupFrame, rowFrame, usernameFrame] = await Promise.all([
		getFrame(objc, group),
		getFrame(objc, row),
		getFrame(objc, username),
	]);

	if (!groupFrame || !rowFrame || !usernameFrame) {
		throw new Error('Message latency username row has an unsupported native frame');
	}

	// Allow half a point of rounding when deciding a view sits after another.
	const usernameEnd = usernameFrame.x + usernameFrame.width - 0.5;
	const groupEnd = groupFrame.x + groupFrame.width - 0.5;
	const usernameKey = viewKey(objc, username);
	const siblings = (await getSubviews(objc, group)).filter(
		(view) => viewKey(objc, view) !== usernameKey,
	);
	const trailing = (await placed(objc, siblings))
		.filter(hasFrame)
		.filter(({ frame }) => frame.x >= usernameEnd)
		.sort((left, right) => left.frame.x - right.frame.x);
	const timestamp = (await placed(objc, await getSubviews(objc, row)))
		.filter(hasFrame)
		.find(({ view, frame }) => objc.className(view) === 'DCDLabel' && frame.x >= groupEnd);

	if (!timestamp) throw new Error('Message latency timestamp row is unavailable');

	const header = headerLayout({
		row: { view: row, frame: rowFrame },
		group: { view: group, frame: groupFrame },
		username: { view: username, frame: usernameFrame },
		trailing,
		timestamp,
		icon,
	});
	const layout: Layout = {
		views: await Promise.all(
			[group, username, ...trailing.map(({ view }) => view), timestamp.view].map((view) =>
				save(objc, view),
			),
		),
		constraints: [],
	};

	try {
		for (const { view } of layout.views) {
			await safeInvokeAsync(
				objc,
				view,
				'setTranslatesAutoresizingMaskIntoConstraints:',
				false,
			);
		}

		await safeInvokeAsync(objc, icon, 'setTranslatesAutoresizingMaskIntoConstraints:', false);
		await safeInvokeAsync(objc, group, 'addSubview:', icon);
		await constrain(objc, row, header.row, layout);
		await constrain(objc, group, header.group, layout);
	} catch (error) {
		await restoreLayout(objc, layout);
		await safeInvokeAsync(objc, icon, 'removeFromSuperview');

		throw error;
	}

	return layout;
}

export default { installLayout, restoreLayout };
