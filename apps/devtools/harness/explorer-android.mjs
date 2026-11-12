// Spoofed Java classes for `explorer.mjs`, shaped like the client's mapping of `java.describe(name)`:
// declared fields, methods, constructors and interfaces with parameter types and static flags.

const field = (signature) => {
	const isStatic = /\bstatic\b/.test(signature);
	const [type, name] = signature
		.replace(/^((public|protected|private|static|final|transient|volatile) )+/, '')
		.split(' ');

	return {
		name,
		kind: 'fields',
		type,
		signature,
		...(isStatic ? { static: true } : {}),
		read: 'auto',
	};
};

/** A method or constructor row from its declaration, `public void setAlpha(float)`. */
function member(signature, kind = 'methods') {
	const [, head, params] = /^(.*)\((.*)\)$/.exec(signature);
	const words = head.split(' ');
	const name = words.pop();
	const returnType = kind === 'constructors' ? undefined : words.pop();
	const isStatic = words.includes('static');

	return {
		name,
		kind,
		type: null,
		signature,
		...(returnType ? { returnType } : {}),
		parameters: params ? params.split(', ') : [],
		...(isStatic ? { static: true } : {}),
		read: 'never',
	};
}

const iface = (name) => ({ name, kind: 'interfaces', type: null, signature: null, read: 'never' });

const VERBS = ['dispatch', 'invalidate', 'resolve', 'notify', 'onPopulate', 'compute'];
const NOUNS = [
	'Layout',
	'Draw',
	'Focus',
	'Accessibility',
	'Scroll',
	'Touch',
	'Hover',
	'Insets',
	'Drawable',
	'Padding',
];
const SUFFIXES = ['()', 'Internal()', '(int)', '(boolean, int)', '(android.graphics.Canvas)'];

const VIEW_METHODS = [
	'public void setAlpha(float)',
	'public float getAlpha()',
	'public void setVisibility(int)',
	'public int getVisibility()',
	'public void setBackground(android.graphics.drawable.Drawable)',
	'public android.graphics.drawable.Drawable getBackground()',
	'public void setOnClickListener(android.view.View$OnClickListener)',
	'public boolean performClick()',
	'public void invalidate()',
	'public void requestLayout()',
	'public final void measure(int, int)',
	'public void layout(int, int, int, int)',
	'protected void onDraw(android.graphics.Canvas)',
	'protected void onMeasure(int, int)',
	'public boolean dispatchTouchEvent(android.view.MotionEvent)',
	'public android.view.ViewParent getParent()',
	'public android.content.Context getContext()',
	'public static int generateViewId()',
	'public static android.view.View inflate(android.content.Context, int, android.view.ViewGroup)',
	'public void setTag(int, java.lang.Object)',
];

// android.view.View carries 300 methods, three pages of EXPLORER_MEMBERS_PAGE_SIZE.
const viewMethods = [
	...VIEW_METHODS,
	...VERBS.flatMap((verb) =>
		NOUNS.flatMap((noun) => SUFFIXES.map((suffix) => `void ${verb}${noun}${suffix}`)),
	),
]
	.slice(0, 300)
	.map((signature) => member(signature));

function define(name, superclass, members) {
	return { name, superclass, image: null, instanceSize: null, members };
}

export const ANDROID_CLASSES = new Map(
	[
		define('java.lang.Object', null, {
			fields: [],
			methods: [
				'public boolean equals(java.lang.Object)',
				'public final java.lang.Class getClass()',
				'public int hashCode()',
				'public java.lang.String toString()',
				'public final void notify()',
			].map((signature) => member(signature)),
			constructors: [member('public java.lang.Object()', 'constructors')],
			interfaces: [],
		}),
		define('android.view.View', 'java.lang.Object', {
			fields: [
				'public static final int VISIBLE',
				'public static final int INVISIBLE',
				'public static final int GONE',
				'protected android.content.Context mContext',
				'protected int mLeft',
				'protected int mTop',
				'protected int mRight',
				'protected int mBottom',
				'protected int mPaddingLeft',
				'protected int mPaddingTop',
				'int mViewFlags',
				'int mPrivateFlags',
				'private float mAlpha',
				'private int mID',
				'protected android.view.ViewParent mParent',
				'private android.graphics.drawable.Drawable mBackground',
				'private java.lang.CharSequence mContentDescription',
				'protected java.lang.Object mTag',
				'private int[] mDrawableState',
				'private android.view.View$ListenerInfo mListenerInfo',
				'private static final java.lang.String TAG',
			].map(field),
			methods: viewMethods,
			constructors: [
				'public android.view.View(android.content.Context)',
				'public android.view.View(android.content.Context, android.util.AttributeSet)',
				'public android.view.View(android.content.Context, android.util.AttributeSet, int)',
				'public android.view.View(android.content.Context, android.util.AttributeSet, int, int)',
			].map((signature) => member(signature, 'constructors')),
			interfaces: [
				'android.graphics.drawable.Drawable$Callback',
				'android.view.KeyEvent$Callback',
				'android.view.accessibility.AccessibilityEventSource',
			].map(iface),
		}),
		define('android.view.ViewGroup', 'android.view.View', {
			fields: [
				'private android.view.View[] mChildren',
				'private int mChildrenCount',
				'protected int mGroupFlags',
				'private android.view.View mFocused',
				'public static final int FOCUS_BEFORE_DESCENDANTS',
			].map(field),
			methods: [
				'public void addView(android.view.View)',
				'public void addView(android.view.View, int)',
				'public void removeView(android.view.View)',
				'public int getChildCount()',
				'public android.view.View getChildAt(int)',
				'protected abstract void onLayout(boolean, int, int, int, int)',
				'public boolean onInterceptTouchEvent(android.view.MotionEvent)',
				'public static int getChildMeasureSpec(int, int, int)',
			].map((signature) => member(signature)),
			constructors: [
				'public android.view.ViewGroup(android.content.Context)',
				'public android.view.ViewGroup(android.content.Context, android.util.AttributeSet)',
			].map((signature) => member(signature, 'constructors')),
			interfaces: ['android.view.ViewParent', 'android.view.ViewManager'].map(iface),
		}),
		define('com.facebook.react.views.view.ReactViewGroup', 'android.view.ViewGroup', {
			fields: [
				'private boolean mRemoveClippedSubviews',
				'private android.graphics.Rect mClippingRect',
				'private android.graphics.Rect mHitSlopRect',
				'private java.lang.String mOverflow',
				'private com.facebook.react.uimanager.PointerEvents mPointerEvents',
				'private float mBackfaceOpacity',
				'private static final int ARRAY_CAPACITY_INCREMENT',
			].map(field),
			methods: [
				'public void setRemoveClippedSubviews(boolean)',
				'public void updateClippingRect()',
				'public void setHitSlopRect(android.graphics.Rect)',
				'public void setOverflow(java.lang.String)',
				'public void setBackfaceVisibility(java.lang.String)',
				'public boolean onInterceptTouchEvent(android.view.MotionEvent)',
				'protected void dispatchDraw(android.graphics.Canvas)',
			].map((signature) => member(signature)),
			constructors: [
				member(
					'public com.facebook.react.views.view.ReactViewGroup(android.content.Context)',
					'constructors',
				),
			],
			interfaces: [
				'com.facebook.react.uimanager.ReactInterceptingViewGroup',
				'com.facebook.react.uimanager.ReactClippingViewGroup',
				'com.facebook.react.uimanager.ReactPointerEventsView',
				'com.facebook.react.uimanager.ReactZIndexedViewGroup',
			].map(iface),
		}),
		define('android.graphics.drawable.ColorDrawable', 'java.lang.Object', {
			fields: [
				'private android.graphics.drawable.ColorDrawable$ColorState mColorState',
				'private boolean mMutated',
			].map(field),
			methods: ['public int getColor()', 'public void setColor(int)'].map((signature) =>
				member(signature),
			),
			constructors: [
				member('public android.graphics.drawable.ColorDrawable(int)', 'constructors'),
			],
			interfaces: [],
		}),
	].map((cls) => [cls.name, cls]),
);

/** A plain class for a name the spoof has no members for: two fields, a method and a constructor. */
export function synthesizeAndroid(name, superclass) {
	return define(name, superclass, {
		fields: [`private int m${name.split(/[.$]/).pop()}State`, 'private boolean mAttached'].map(
			field,
		),
		methods: [member('protected void onAttachedToWindow()')],
		constructors: [member(`public ${name}(android.content.Context)`, 'constructors')],
		interfaces: [],
	});
}
