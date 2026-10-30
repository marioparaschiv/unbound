package main

import (
	"strings"
	"testing"
)

func referenceKeys(set *compatSourceSet) map[string]bool {
	keys := map[string]bool{}
	for _, reference := range set.sorted() {
		keys[reference.Kind+" "+reference.Class+" "+reference.Name+strings.Join(reference.Terms, ",")] = true
	}
	return keys
}

func expectKeys(t *testing.T, set *compatSourceSet, present []string, absent []string) {
	t.Helper()
	keys := referenceKeys(set)
	for _, key := range present {
		if !keys[key] {
			t.Errorf("missing reference %q in %v", key, keys)
		}
	}
	for _, key := range absent {
		if keys[key] {
			t.Errorf("unexpected reference %q", key)
		}
	}
}

func expectNoDynamic(t *testing.T, set *compatSourceSet) {
	t.Helper()
	if len(set.dynamicSites) > 0 {
		t.Fatalf("expected no skipped lookups, got %+v", set.dynamicSites)
	}
}

func TestCompatForwarderInference(t *testing.T) {
	set := scriptProgramReferences(t, map[string]string{
		"packages/plugins-shared/src/native/safe-invoke.ts": `
export function safeInvoke(objc: NativeObjCBridge, handle: NativeHandle, selector: string, ...args: unknown[]): unknown {
	try {
		return objc.invoke(handle, selector, args, { thread: 'main' });
	} catch {
		return null;
	}
}
export default { safeInvoke };
`,
		"packages/plugins-shared/src/native/ensure-classes.ts": `
export function ensureClasses(plugin: string, objc: NativeObjCBridge, classes: string[]): boolean {
	return !classes.filter((name) => !objc.getClass(name)).length;
}
`,
		"packages/plugins/demo/src/native/bridge.ts": `
import { safeInvoke } from '@astral-plugins/shared/native/safe-invoke';

export type Bridge = ReturnType<typeof createBridge>;

export function createBridge(objc: NativeObjCBridge) {
	function call(target: Handle, selector: string, ...args: unknown[]): unknown {
		return safeInvoke(objc, target, selector, ...args);
	}

	function handle(target: Handle, selector: string) {
		return call(target, selector) as Handle;
	}

	function classes(...names: string[]) {
		return names.map((name) => objc.getClass(name));
	}

	return { objc, call, handle, classes };
}
`,
		"packages/plugins/demo/src/native/views.ts": `
import type { Bridge } from './bridge';
import ensure from '@astral-plugins/shared/native/ensure-classes';
import { ensureClasses } from '@astral-plugins/shared/native/ensure-classes';

const REQUIRED = ['DCDMessageTableViewCell', 'DCDTableView'] as const;

export function layout(bridge: Bridge, view: Handle) {
	bridge.call(view, 'layoutSubviews');
	bridge.handle(view, 'superview');
	bridge.classes('UIImage', 'DCDLabel');
	ensureClasses('Demo', bridge.objc, [...REQUIRED]);
}
`,
		"packages/plugins/demo/src/android/rows.ts": `
export function createRows(java: NativeJavaBridge) {
	function isA(className: string, view: NativeJavaReference): boolean {
		return java.invoke(java.getClass(className), 'isInstance', [view]);
	}

	function bindingView(view: NativeJavaReference, field: string) {
		return java.getField(view, field);
	}

	return (view: NativeJavaReference) => isA('com.discord.reactions.ReactionView', view) && bindingView(view, 'header');
}
`,
		"packages/client/src/api/metro/wrappers.ts": `
export function findByPropsLazy(...args: TermOrOptions[]) {
	return lazy(() => require('~/api/metro').findByProps(...args));
}
`,
		"packages/client/src/api/stores.ts": `
import { findByPropsLazy } from '~/api/metro/wrappers';

export const Actions = findByPropsLazy('transitionToGuild', 'selectChannel', { lazy: true });
`,
	})
	expectNoDynamic(t, set)
	expectKeys(t, set, []string{
		"objc-method  layoutSubviews",
		"objc-method  superview",
		"objc-class  UIImage",
		"objc-class  DCDLabel",
		"objc-class  DCDMessageTableViewCell",
		"objc-class  DCDTableView",
		"java-class  com.discord.reactions.ReactionView",
		"java-field  header",
		"props  transitionToGuild,selectChannel",
	}, nil)
}

func TestCompatConstantResolution(t *testing.T) {
	set := scriptProgramReferences(t, map[string]string{
		"packages/plugins/demo/src/constants.ts": `
export const NativeClass = {
	messageCell: 'DCDMessageTableViewCell',
	table: 'DCDTableView',
};
export const TEXT_VIEWS = ['DCDAttributedTextView', 'DCDReusableYYLabel'] as const;
export const SELECTOR = ` + "`layoutSubviews`" + `;
`,
		"packages/plugins/demo/src/native/hooks.ts": `
import { NativeClass, TEXT_VIEWS, SELECTOR } from '~/constants';

type HookSpec = [className: string, selector: string, handlers: object];

function textViewClasses(objc: NativeObjCBridge): string[] {
	return TEXT_VIEWS.filter((name) => objc.getClass(name));
}

function specs(objc: NativeObjCBridge): HookSpec[] {
	const classes = textViewClasses(objc);

	return [
		...classes.map((name): HookSpec => [name, 'setAttributedText:', {}]),
		['DCDMessageTableViewCell', 'prepareForReuse', {}],
	];
}

export function install(objc: NativeObjCBridge, label: Handle) {
	objc.hook(NativeClass.table, SELECTOR, {});
	objc.hook(objc.className(label) ?? TEXT_VIEWS[0], 'didMoveToWindow', {});

	const handlers: [className: string, selector: string, object][] = [
		['UIControl', 'endTrackingWithTouch:withEvent:', { after: () => undefined }],
		['DCDLabel', 'setText:', {}],
	];

	for (const [className, selector, handler] of handlers) {
		objc.hook(className, selector, handler);
	}

	for (const selector of ['setAttributedText:', 'layoutSubviews']) {
		objc.hook('DCDChatInputComponentView', selector, {});
	}

	const [required, ...optional] = specs(objc);
	objc.hook(...required);
	for (const spec of optional) objc.hook(...spec);

	const fallback = label ? 'DCDThemeView' : 'DCDOtherView';
	objc.getClass(objc.className(label) || fallback);
	TEXT_VIEWS.forEach((name) => objc.findViews(label, name));
}
`,
	})
	expectNoDynamic(t, set)
	expectKeys(t, set, []string{
		"objc-method DCDTableView layoutSubviews",
		"objc-method DCDAttributedTextView didMoveToWindow",
		"objc-method UIControl endTrackingWithTouch:withEvent:",
		"objc-method DCDLabel setText:",
		"objc-method DCDChatInputComponentView setAttributedText:",
		"objc-method DCDChatInputComponentView layoutSubviews",
		"objc-method DCDAttributedTextView setAttributedText:",
		"objc-method DCDReusableYYLabel setAttributedText:",
		"objc-method DCDMessageTableViewCell prepareForReuse",
		"objc-class  DCDThemeView",
		"objc-class  DCDOtherView",
		"objc-class  DCDReusableYYLabel",
	}, []string{
		"objc-method DCDLabel endTrackingWithTouch:withEvent:",
		"objc-method UIControl setText:",
		"objc-method DCDReusableYYLabel didMoveToWindow",
	})
}

func TestCompatSkippedSites(t *testing.T) {
	set := scriptProgramReferences(t, map[string]string{
		"packages/plugins/demo/src/native/index.ts": `
export function start(objc: NativeObjCBridge, name: string) {
	function hook(className: string, selector: string) {
		return objc.hook(className, selector, {});
	}

	objc.getClass(readName());
	hook('DCDLabel', 'setText:');
	return ['DCDLabel'].map((className) => objc.invoke(view, className + ':', []));
}

export function later(objc: NativeObjCBridge) {
	function lookup(className: string) {
		return objc.getClass(className);
	}

	return names().map(lookup);
}
`,
	})
	expectKeys(t, set, []string{"objc-method DCDLabel setText:"}, nil)
	var calls []string
	for _, site := range set.dynamicSites {
		calls = append(calls, site.Call)
	}
	joined := strings.Join(calls, ";")
	for _, expected := range []string{"objc.getClass", "objc.invoke", "lookup (not called with names the scan can read)"} {
		if !strings.Contains(joined, expected) {
			t.Fatalf("expected a skipped %q site, got %v", expected, calls)
		}
	}
	if strings.Contains(joined, "objc.hook") {
		t.Fatalf("a forwarder definition must not count as skipped: %v", calls)
	}
}

func TestCompatBridgeReceivers(t *testing.T) {
	set := scriptProgramReferences(t, map[string]string{
		"packages/plugins-shared/src/native/message-info.ts": `
export type NativeMessageCellBridge = {
	getIvar(handle: NativeObjectHandle, name: string): unknown;
	respondsTo(handle: NativeHandle, selector: string): boolean;
};

export type TextBridge = ReturnType<typeof createTextBridge>;

export function createTextBridge(objc: NativeObjCBridge) {
	return {
		call(target: Handle, selector: string) {
			return objc.invoke(target, selector, []);
		},
		getClass: (name: string) => objc.getClass(name),
	};
}

export function readMessage(bridge: NativeMessageCellBridge, text: TextBridge, cell: NativeObjectHandle) {
	bridge.getIvar(cell, 'viewModel');
	text.call(cell, 'attributedText');
	text.getClass('DCDLabel');
	mystery.invoke(cell, 'hiddenSelector', []);
	setLocale.call(this, resolve());
}
`,
	})
	expectKeys(t, set, []string{"objc-ivar  viewModel", "objc-method  attributedText", "objc-class  DCDLabel"}, []string{"objc-method  hiddenSelector"})
	if len(set.dynamicSites) != 1 || set.dynamicSites[0].Call != "mystery.invoke (unknown bridge)" {
		t.Fatalf("a lookup through an unknown receiver must be reported, got %+v", set.dynamicSites)
	}
}
