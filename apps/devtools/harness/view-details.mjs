// Spoofed `view-details-result` payloads, shaped like the sections `view-details-android.dev.ts` and
// `view-details-ios.dev.ts` read on a device.

const ANDROID_CHAINS = {
	TextView: ['android.widget.TextView', 'android.view.View'],
	ImageView: ['android.widget.ImageView', 'android.view.View'],
	EditText: ['android.widget.EditText', 'android.widget.TextView', 'android.view.View'],
	ViewGroup: ['android.view.ViewGroup', 'android.view.View'],
	RecyclerView: [
		'androidx.recyclerview.widget.RecyclerView',
		'android.view.ViewGroup',
		'android.view.View',
	],
	FrameLayout: ['android.widget.FrameLayout', 'android.view.ViewGroup', 'android.view.View'],
};
const IOS_CHAINS = {
	UILabel: ['UILabel', 'UIView', 'UIResponder'],
	UIImageView: ['UIImageView', 'UIView', 'UIResponder'],
	UITextView: ['UITextView', 'UIScrollView', 'UIView', 'UIResponder'],
	UITableView: ['UITableView', 'UIScrollView', 'UIView', 'UIResponder'],
	UICollectionView: ['UICollectionView', 'UIScrollView', 'UIView', 'UIResponder'],
	UITableViewCell: ['UITableViewCell', 'UIView', 'UIResponder'],
	UIWindow: ['UIWindow', 'UIView', 'UIResponder'],
	UIView: ['UIView', 'UIResponder'],
};

const p = (key, value, unit) => (unit ? { key, value, unit } : { key, value });
const color = (key, value) => ({ key, value, kind: 'color' });
const rect = ({ x, y, width, height }) => `${x} ${y} ${width} ${height}`;

function androidKind(node) {
	const name = node.className;

	if (/EditText$/.test(name)) return 'EditText';
	if (/Text(View)?$/.test(name)) return 'TextView';
	if (/(Image|Drawee)View$/.test(name)) return 'ImageView';
	if (/ListView$/.test(name)) return 'RecyclerView';
	if (/FrameLayout|DecorView/.test(name)) return 'FrameLayout';

	return node.children.length || /ViewGroup|Layout|RootView/.test(name) ? 'ViewGroup' : 'View';
}

function iosKind(node) {
	const name = node.className;

	if (/Label$|Paragraph/.test(name)) return 'UILabel';
	if (/TextView$/.test(name)) return 'UITextView';
	if (/ImageView$|AvatarView$/.test(name)) return 'UIImageView';
	if (/TableView$/.test(name)) return 'UITableView';
	if (/CollectionView$/.test(name)) return 'UICollectionView';
	if (/Cell$/.test(name)) return 'UITableViewCell';
	if (/Window$/.test(name)) return 'UIWindow';

	return 'UIView';
}

function chainOf(node, chains, base) {
	const kind = chains[node.kind] ?? base;

	return kind[0] === node.className ? kind : [node.className, ...kind];
}

function android(node) {
	const kind = androidKind(node);
	const group = kind === 'ViewGroup' || kind === 'RecyclerView' || kind === 'FrameLayout';
	const text = kind === 'TextView' || kind === 'EditText';
	const sections = [
		{
			title: 'Layout',
			properties: [
				p('measuredWidth', node.frame.width, 'dp'),
				p('measuredHeight', node.frame.height, 'dp'),
				p('padding', text ? '0 4 0 4' : '0 0 0 0', 'dp'),
				p('margin', '0 0 0 0', 'dp'),
				p('layoutWidth', node.frame.width >= 390 ? 'match_parent' : node.frame.width),
				p('layoutHeight', text ? 'wrap_content' : node.frame.height),
				p('layoutParams', 'android.view.ViewGroup$MarginLayoutParams'),
				p('scrollX', 0, 'dp'),
				p('scrollY', kind === 'RecyclerView' ? 1240 : 0, 'dp'),
			],
		},
		{
			title: 'Transform',
			properties: [
				p('translationX', 0, 'dp'),
				p('translationY', 0, 'dp'),
				p('elevation', group ? 0 : 1.5, 'dp'),
				p('rotation', 0, '°'),
				p('scaleX', 1),
				p('scaleY', 1),
			],
		},
		{
			title: 'State',
			properties: [
				p('enabled', true),
				p('clickable', kind === 'ImageView' || /MessageView$/.test(node.className)),
				p('longClickable', /MessageView$/.test(node.className)),
				p('hasClickListener', /MessageView$/.test(node.className)),
				p('focusable', kind === 'EditText'),
				p('focused', false),
				p('selected', false),
				p('pressed', false),
				p('shown', node.visibility !== 'gone'),
				p('attached', true),
				p('laidOut', true),
			],
		},
		{
			title: 'Drawing',
			properties: [
				group ? color('background', '#313338FF') : p('background', null),
				p('foreground', null),
				p('layerType', 'none'),
				p('clipToOutline', kind === 'ImageView'),
				p('willNotDraw', group),
			],
		},
		{
			title: 'Accessibility',
			properties: [
				p('id', node.resourceName ? 2131362000 : 47),
				p('contentDescription', node.text ?? null),
				p('importantForAccessibility', 'auto'),
				p('tag', null),
			],
		},
	];

	if (group) {
		sections.push({
			title: 'ViewGroup',
			properties: [
				p('childCount', node.children.length),
				p('clipChildren', true),
				p('clipToPadding', true),
				p('descendantFocusability', 'beforeDescendants'),
			],
		});
	}

	if (text) {
		sections.push({
			title: 'Text',
			properties: [
				p('textSize', 16, 'dp'),
				color('textColor', node.alpha < 1 ? '#B5BAC1FF' : '#F2F3F5FF'),
				p('lineCount', 1),
				p('maxLines', 'none'),
				p('lineHeight', 20, 'dp'),
				p('gravity', '0x800033'),
				p('ellipsize', 'END'),
				p('typeface', 'normal'),
				p('hint', kind === 'EditText' ? 'Message #general' : null),
			],
		});
	}

	if (kind === 'ImageView') {
		sections.push({
			title: 'Image',
			properties: [
				p('scaleType', 'CENTER_CROP'),
				p('drawable', 'com.facebook.drawee.generic.RootDrawable'),
				p('imageAlpha', 255),
				p('adjustViewBounds', false),
			],
		});
	}

	return {
		classChain: chainOf({ ...node, kind }, ANDROID_CHAINS, ['android.view.View']),
		sections,
	};
}

function ios(node) {
	const kind = iosKind(node);
	const scroll = kind === 'UITableView' || kind === 'UICollectionView' || kind === 'UITextView';
	const sections = [
		{
			title: 'Layout',
			properties: [
				p('frame', rect(node.frame), 'pt'),
				p('bounds', `0 0 ${node.frame.width} ${node.frame.height}`, 'pt'),
				p(
					'center',
					`${node.frame.x + node.frame.width / 2} ${node.frame.y + node.frame.height / 2}`,
					'pt',
				),
				p('transform', 'identity'),
				p('intrinsicContentSize', kind === 'UILabel' ? '96 20' : '-1 -1', 'pt'),
				p('safeAreaInsets', kind === 'UIWindow' ? '47 0 34 0' : '0 0 0 0', 'pt'),
				p('layoutMargins', '8 8 8 8', 'pt'),
				p('autoresizingConstraints', true),
			],
		},
		{
			title: 'State',
			properties: [
				p('hidden', (node.visibility ?? 'visible') !== 'visible'),
				p('alpha', node.alpha ?? 1),
				p('userInteractionEnabled', kind !== 'UILabel'),
				p('multipleTouchEnabled', false),
				p('exclusiveTouch', false),
				p('firstResponder', false),
				p(
					'gestureRecognizers',
					kind === 'UITableViewCell' ? 'UILongPressGestureRecognizer' : 'none',
				),
				p('viewController', 'DCDChatViewController'),
				p('tag', 0),
			],
		},
		{
			title: 'Drawing',
			properties: [
				kind === 'UIView'
					? p('backgroundColor', null)
					: color('backgroundColor', '#313338FF'),
				color('tintColor', '#5865F2FF'),
				p('opaque', false),
				p('clipsToBounds', scroll),
				p('contentMode', kind === 'UIImageView' ? 'scaleAspectFill' : 'scaleToFill'),
			],
		},
		{
			title: 'Layer',
			properties: [
				p('cornerRadius', node.className === 'DCDAvatarView' ? 20 : 0, 'pt'),
				p('borderWidth', 0, 'pt'),
				p('masksToBounds', node.className === 'DCDAvatarView'),
				p('opacity', 1),
				p('zPosition', 0),
				p('shadowOpacity', 0),
				p('shadowRadius', 3, 'pt'),
				p('shadowOffset', '0 -3', 'pt'),
			],
		},
		{
			title: 'Accessibility',
			properties: [
				p('identifier', node.resourceName ?? null),
				p('label', node.text ?? null),
				p('element', Boolean(node.text)),
				p('traits', node.text ? 'staticText' : 'none'),
			],
		},
	];

	if (kind === 'UILabel' || kind === 'UITextView') {
		sections.push({
			title: 'Text',
			properties: [
				p('font', 'ggsans-Medium'),
				p('pointSize', 16, 'pt'),
				color('textColor', '#F2F3F5FF'),
				p('numberOfLines', 0),
				p('textAlignment', 'natural'),
				p('lineBreakMode', 'truncateTail'),
			],
		});
	}

	if (scroll) {
		sections.push({
			title: 'Scroll',
			properties: [
				p('contentOffset', '0 1240', 'pt'),
				p('contentSize', `${node.frame.width} 5320`, 'pt'),
				p('contentInset', '0 0 0 0', 'pt'),
				p('scrollEnabled', true),
				p('dragging', false),
				p('decelerating', false),
			],
		});
	}

	if (/^RCT/.test(node.className)) {
		sections.push({
			title: 'React Native',
			properties: [p('reactTag', 112), p('nativeID', null)],
		});
	}

	return {
		classChain: chainOf({ ...node, kind }, IOS_CHAINS, ['UIView', 'UIResponder']),
		sections,
	};
}

/**
 * The spoofed class chain and properties of a listed view.
 * @param {{ className: string, frame: object, children: object[], text?: string, alpha?: number, visibility?: string, resourceName?: string }} node
 * @param {'android' | 'ios'} platform
 */
export function detailsOf(node, platform) {
	return platform === 'ios' ? ios(node) : android(node);
}
