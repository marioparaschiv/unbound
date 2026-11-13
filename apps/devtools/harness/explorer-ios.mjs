// Spoofed Objective-C classes and images for `explorer.mjs`, shaped like UnboundInspector.dylib's
// `describeClass`, `listMembers`, `listImages` and `listClasses` answers once the client maps them.

const DISCORD = '/private/var/containers/Bundle/Application/4F1C0D2E/Discord.app/Discord';
const UIKIT = '/System/Library/PrivateFrameworks/UIKitCore.framework/UIKitCore';
const QUARTZ = '/System/Library/Frameworks/QuartzCore.framework/QuartzCore';
const LIBOBJC = '/usr/lib/libobjc.A.dylib';

const property = (name, type, attributes, read = 'auto') => ({
	name,
	kind: 'properties',
	type,
	signature: `@property (${attributes.join(', ')}) ${type}${type.endsWith('*') ? '' : ' '}${name}`,
	attributes,
	read,
});

const ivar = (name, type, offset, size, read = 'auto') => ({
	name,
	kind: 'ivars',
	type,
	signature: `${type}${type.endsWith('*') ? '' : ' '}${name}`,
	offset,
	size,
	read,
});

/** A method row from its declaration, `- (void)setFrame:(CGRect)frame`. */
function method(signature, image) {
	const returnType = /^[-+] \((.+?)\)/.exec(signature)[1];
	const rest = signature.replace(/^[-+] \(.+?\)/, '');
	const parts = [...rest.matchAll(/(\w*):\((.+?)\)\w+/g)];
	const name = parts.length ? parts.map(([, label]) => `${label}:`).join('') : rest;

	return {
		name,
		kind: signature.startsWith('+') ? 'classMethods' : 'methods',
		type: null,
		signature,
		returnType,
		parameters: parts.map(([, , type]) => type),
		...(image ? { image } : {}),
		read: 'never',
	};
}

const protocol = (name) => ({
	name,
	kind: 'protocols',
	type: null,
	signature: null,
	read: 'never',
});

const VERBS = ['update', 'invalidate', 'apply', 'layout', 'resolve', 'notify'];
const NOUNS = [
	'Constraints',
	'Appearance',
	'TraitCollection',
	'SafeArea',
	'FocusGuide',
	'Hover',
	'Pointer',
	'Animation',
	'Geometry',
	'Accessibility',
];
const SUFFIXES = [
	'',
	'IfNeeded',
	'Animated:(BOOL)animated',
	'ForTraitCollection:(UITraitCollection *)traitCollection',
	'WithContext:(id)context',
];

const UIVIEW_METHODS = [
	'- (instancetype)initWithFrame:(CGRect)frame',
	'- (instancetype)initWithCoder:(NSCoder *)coder',
	'- (void)setFrame:(CGRect)frame',
	'- (CGRect)frame',
	'- (void)setBackgroundColor:(UIColor *)backgroundColor',
	'- (void)addSubview:(UIView *)view',
	'- (void)removeFromSuperview',
	'- (void)insertSubview:(UIView *)view atIndex:(NSInteger)index',
	'- (void)layoutSubviews',
	'- (void)setNeedsLayout',
	'- (void)layoutIfNeeded',
	'- (void)setNeedsDisplay',
	'- (void)drawRect:(CGRect)rect',
	'- (CGSize)sizeThatFits:(CGSize)size',
	'- (UIView *)hitTest:(CGPoint)point withEvent:(UIEvent *)event',
	'- (BOOL)pointInside:(CGPoint)point withEvent:(UIEvent *)event',
	'- (CGPoint)convertPoint:(CGPoint)point toView:(UIView *)view',
	'- (void)didMoveToWindow',
	'- (void)didMoveToSuperview',
	'- (void)traitCollectionDidChange:(UITraitCollection *)previousTraitCollection',
];

// UIView carries 300 instance methods, three pages of EXPLORER_MEMBERS_PAGE_SIZE.
const uiViewMethods = [
	...UIVIEW_METHODS,
	...VERBS.flatMap((verb) =>
		NOUNS.flatMap((noun) => SUFFIXES.map((suffix) => `- (void)_${verb}${noun}${suffix}`)),
	),
]
	.slice(0, 300)
	.map((signature) => method(signature));

function define(name, superclass, image, instanceSize, members) {
	return { name, superclass, image, instanceSize, members };
}

export const IOS_CLASSES = new Map(
	[
		define('NSObject', null, LIBOBJC, 8, {
			properties: [
				property('hash', 'NSUInteger', ['readonly']),
				property('description', 'NSString *', ['readonly', 'copy'], 'manual'),
				property('debugDescription', 'NSString *', ['readonly', 'copy'], 'manual'),
			],
			ivars: [ivar('isa', 'Class', 0, 8)],
			methods: [
				'- (instancetype)init',
				'- (void)dealloc',
				'- (BOOL)isKindOfClass:(Class)aClass',
				'- (BOOL)respondsToSelector:(SEL)aSelector',
				'- (id)performSelector:(SEL)aSelector',
			].map((signature) => method(signature)),
			classMethods: [
				'+ (instancetype)alloc',
				'+ (instancetype)new',
				'+ (Class)class',
				'+ (BOOL)instancesRespondToSelector:(SEL)aSelector',
			].map((signature) => method(signature)),
			protocols: [protocol('NSObject')],
		}),
		define('UIResponder', 'NSObject', UIKIT, 16, {
			properties: [
				property('nextResponder', 'UIResponder *', ['readonly', 'nonatomic'], 'manual'),
				property('canBecomeFirstResponder', 'BOOL', ['readonly', 'nonatomic'], 'manual'),
				property('isFirstResponder', 'BOOL', ['readonly', 'nonatomic'], 'manual'),
				property('inputView', 'UIView *', ['readonly', 'nonatomic', 'strong'], 'never'),
			],
			ivars: [ivar('_responderFlags', 'struct { unsigned int _x : 1; }', 8, 8)],
			methods: [
				'- (BOOL)becomeFirstResponder',
				'- (BOOL)resignFirstResponder',
				'- (void)touchesBegan:(NSSet *)touches withEvent:(UIEvent *)event',
				'- (void)touchesEnded:(NSSet *)touches withEvent:(UIEvent *)event',
			].map((signature) => method(signature)),
			classMethods: [
				method('+ (void)clearTextInputContextIdentifier:(NSString *)identifier'),
			],
			protocols: [
				protocol('UIResponderStandardEditActions'),
				protocol('UIPasteConfigurationSupporting'),
			],
		}),
		define('UIView', 'UIResponder', UIKIT, 480, {
			properties: [
				property('frame', 'CGRect', ['nonatomic']),
				property('bounds', 'CGRect', ['nonatomic']),
				property('center', 'CGPoint', ['nonatomic']),
				property('transform', 'CGAffineTransform', ['nonatomic']),
				property('alpha', 'CGFloat', ['nonatomic']),
				property('hidden', 'BOOL', ['nonatomic', 'getter=isHidden']),
				property('opaque', 'BOOL', ['nonatomic', 'getter=isOpaque']),
				property('clipsToBounds', 'BOOL', ['nonatomic']),
				property('tag', 'NSInteger', ['nonatomic']),
				property('backgroundColor', 'UIColor *', ['nonatomic', 'copy']),
				property('tintColor', 'UIColor *', ['nonatomic', 'strong'], 'manual'),
				property('layer', 'CALayer *', ['readonly', 'nonatomic', 'strong']),
				property('superview', 'UIView *', ['readonly', 'nonatomic', 'weak']),
				property('window', 'UIWindow *', ['readonly', 'nonatomic', 'weak'], 'manual'),
				property('subviews', 'NSArray *', ['readonly', 'nonatomic', 'copy'], 'manual'),
				property('safeAreaInsets', 'UIEdgeInsets', ['readonly', 'nonatomic'], 'manual'),
				property('accessibilityIdentifier', 'NSString *', ['nonatomic', 'copy']),
				property(
					'_viewDelegate',
					'id',
					['nonatomic', 'weak', 'setter=_setViewDelegate:'],
					'never',
				),
				property('userInteractionEnabled', 'BOOL', [
					'nonatomic',
					'getter=isUserInteractionEnabled',
				]),
				property('contentMode', 'NSInteger', ['nonatomic']),
			],
			ivars: [
				ivar('_layer', 'CALayer *', 16, 8),
				ivar('_gestureRecognizers', 'NSMutableArray *', 24, 8),
				ivar('_subviewCache', 'NSArray *', 32, 8),
				ivar('_viewDelegate', 'id', 40, 8, 'never'),
				ivar('_backgroundColorSystemColorName', 'NSString *', 48, 8),
				ivar('_countOfMotionEffectsInSubtree', 'NSUInteger', 56, 8),
				ivar('_viewFlags', 'struct { unsigned int userInteractionDisabled : 1; }', 64, 16),
				ivar('_cachedTraitCollection', 'UITraitCollection *', 80, 8),
				ivar('_retainCount', 'int', 88, 4),
				ivar('_tintAdjustmentDimmingCount', 'int', 92, 4),
				ivar('_contentScaleFactor', 'double', 96, 8),
				ivar('_animationInfo', 'void *', 104, 8),
				ivar('_traitChangeRegistry', 'id', 112, 8),
			],
			methods: uiViewMethods,
			classMethods: [
				'+ (Class)layerClass',
				'+ (void)animateWithDuration:(NSTimeInterval)duration animations:(id)animations',
				'+ (BOOL)areAnimationsEnabled',
				'+ (void)performWithoutAnimation:(id)actionsWithoutAnimation',
			].map((signature) => method(signature)),
			protocols: [
				'UIAppearance',
				'UIAppearanceContainer',
				'UIDynamicItem',
				'UITraitEnvironment',
				'UICoordinateSpace',
				'UIFocusItem',
				'CALayerDelegate',
			].map(protocol),
		}),
		define('RCTViewComponentView', 'UIView', DISCORD, 640, {
			properties: [
				property('contentView', 'UIView *', ['nonatomic', 'strong']),
				property('nativeId', 'NSString *', ['nonatomic', 'copy']),
				property('removeClippedSubviews', 'BOOL', ['nonatomic']),
				property('hitTestEdgeInsets', 'UIEdgeInsets', ['nonatomic']),
				property('reactSubviews', 'NSArray *', ['readonly', 'nonatomic'], 'manual'),
			],
			ivars: [
				ivar('_contentView', 'UIView *', 480, 8),
				ivar('_nativeId', 'NSString *', 488, 8),
				ivar('_layoutMetrics', 'struct LayoutMetrics', 496, 88),
				ivar('_props', 'shared_ptr<const facebook::react::ViewProps>', 584, 16),
				ivar('_eventEmitter', 'shared_ptr<const facebook::react::EventEmitter>', 600, 16),
				ivar('_borderLayer', 'CALayer *', 616, 8),
				ivar('_needsInvalidateLayer', 'BOOL', 624, 1),
				ivar('_isJSResponder', 'BOOL', 625, 1),
				ivar('_removeClippedSubviews', 'BOOL', 626, 1),
				ivar('_reactTag', 'NSInteger', 632, 8),
			],
			methods: [
				'- (void)updateProps:(const shared_ptr &)props oldProps:(const shared_ptr &)oldProps',
				'- (void)updateLayoutMetrics:(const LayoutMetrics &)layoutMetrics oldLayoutMetrics:(const LayoutMetrics &)oldLayoutMetrics',
				'- (void)finalizeUpdates:(NSInteger)updateMask',
				'- (void)prepareForRecycle',
				'- (void)mountChildComponentView:(UIView *)childComponentView index:(NSInteger)index',
				'- (void)unmountChildComponentView:(UIView *)childComponentView index:(NSInteger)index',
				'- (NSString *)componentViewName_DO_NOT_USE_THIS_IS_BROKEN',
			].map((signature) => method(signature)),
			classMethods: [
				method('+ (ComponentDescriptorProvider)componentDescriptorProvider'),
				method('+ (BOOL)shouldBeRecycled'),
			],
			protocols: [
				protocol('RCTComponentViewProtocol'),
				protocol('RCTTouchableComponentViewProtocol'),
			],
		}),
		define('CALayer', 'NSObject', QUARTZ, 48, {
			properties: [
				property('bounds', 'CGRect', ['nonatomic']),
				property('position', 'CGPoint', ['nonatomic']),
				property('cornerRadius', 'CGFloat', ['nonatomic']),
				property('opacity', 'float', ['nonatomic']),
				property('masksToBounds', 'BOOL', ['nonatomic']),
				property('delegate', 'id', ['nonatomic', 'weak']),
				property('sublayers', 'NSArray *', ['nonatomic', 'copy'], 'manual'),
			],
			ivars: [ivar('_attr', 'struct _CALayerIvars', 8, 40)],
			methods: [
				'- (void)setNeedsDisplay',
				'- (void)addSublayer:(CALayer *)layer',
				'- (void)renderInContext:(CGContextRef)ctx',
			].map((signature) => method(signature)),
			classMethods: [method('+ (instancetype)layer')],
			protocols: [protocol('NSSecureCoding'), protocol('CAMediaTiming')],
		}),
		define('UIColor', 'NSObject', UIKIT, 8, {
			properties: [
				property('CGColor', 'CGColorRef', ['readonly', 'nonatomic']),
				property('systemColorName', 'NSString *', ['readonly', 'nonatomic'], 'manual'),
			],
			ivars: [],
			methods: [
				'- (UIColor *)colorWithAlphaComponent:(CGFloat)alpha',
				'- (BOOL)getRed:(CGFloat *)red green:(CGFloat *)green blue:(CGFloat *)blue alpha:(CGFloat *)alpha',
			].map((signature) => method(signature)),
			classMethods: [
				'+ (UIColor *)colorWithRed:(CGFloat)red green:(CGFloat)green blue:(CGFloat)blue alpha:(CGFloat)alpha',
				'+ (UIColor *)clearColor',
			].map((signature) => method(signature)),
			protocols: [protocol('NSCopying'), protocol('NSSecureCoding')],
		}),
	].map((cls) => [cls.name, cls]),
);

/** A plain class for a name the spoof has no members for: an ivar, a property and two methods. */
export function synthesizeIos(name, superclass, image = name.startsWith('UI') ? UIKIT : DISCORD) {
	const field = name.replace(/^[A-Z]+(?=[A-Z])/, '').replace(/^./, (c) => c.toLowerCase());

	return define(name, superclass, image, 520, {
		properties: [property(`${field}Style`, 'NSInteger', ['nonatomic'])],
		ivars: [ivar(`_${field}Style`, 'NSInteger', 480, 8), ivar('_owner', 'id', 488, 8)],
		methods: [
			method(`- (void)set${field[0].toUpperCase()}${field.slice(1)}Style:(NSInteger)style`),
			method('- (void)layoutSubviews'),
		],
		classMethods: [],
		protocols: [],
	});
}

const SYSTEM_IMAGES = [
	[
		UIKIT,
		[
			'UIView',
			'UIResponder',
			'UIColor',
			'UILabel',
			'UIImageView',
			'UIScrollView',
			'UIWindow',
			'UITraitCollection',
		],
		3200,
	],
	[LIBOBJC, ['NSObject'], 12],
	[QUARTZ, ['CALayer'], 410],
	[
		'/System/Library/Frameworks/Foundation.framework/Foundation',
		['NSArray', 'NSMutableArray', 'NSString', 'NSCoder'],
		1900,
	],
	['/System/Library/Frameworks/CoreFoundation.framework/CoreFoundation', [], 140],
	['/System/Library/PrivateFrameworks/BaseBoard.framework/BaseBoard', [], 520],
];

/** Loaded images that define classes; the app's own image first, then 260 more to page through. */
export const IOS_IMAGES = [
	[DISCORD, ['RCTViewComponentView', 'DisabledProbe'], 1240],
	[
		'/private/var/containers/Bundle/Application/4F1C0D2E/Discord.app/Frameworks/Unbound.dylib',
		[],
		18,
	],
	...SYSTEM_IMAGES,
	...Array.from({ length: 260 }, (_, index) => [
		`/System/Library/PrivateFrameworks/Spoof${String(index).padStart(3, '0')}.framework/Spoof${String(index).padStart(3, '0')}`,
		[],
		(index * 37) % 90,
	]),
].map(([path, known, count]) => {
	const name = path.split('/').pop();
	const prefix = name.replace(/[^A-Z]/g, '').slice(0, 3) || 'X';
	const filler = Array.from(
		{ length: Math.max(count - known.length, 0) },
		(_, i) => `${prefix}${name.slice(0, 4)}Class${String(i).padStart(4, '0')}`,
	);
	const classes = [...known, ...filler].sort();

	return { path, name, classCount: classes.length, classes };
});
