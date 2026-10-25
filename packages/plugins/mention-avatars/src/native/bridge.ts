import type { NativeObjCBridge, NativeObjectHandle } from '@unbound-app/api/native';
import { safeInvoke } from '@unbound-plugins/shared/native/safe-invoke';

export type Handle = NativeObjectHandle;
export type Bridge = ReturnType<typeof createBridge>;

export type KeyValues = Record<string, Handle | number>;

export type TextAttributes = {
	NSFont?: Handle;
	YYTextAttachment?: Handle;
	YYTextHighlight?: Handle;
	UnboundMentionPadding?: boolean;
};

/**
 * @description Wraps the Objective-C bridge with main-thread calls that return `null` instead of throwing.
 * @param objc The plugin's Objective-C bridge.
 * @returns The bridge plus typed call helpers.
 */
export function createBridge(objc: NativeObjCBridge) {
	function call(target: Handle, selector: string, ...args: unknown[]): unknown {
		return safeInvoke(objc, target, selector, ...args);
	}

	function handle(target: Handle, selector: string, ...args: unknown[]): Handle | null {
		return (call(target, selector, ...args) ?? null) as Handle | null;
	}

	function string(target: Handle, selector: string): string | undefined {
		const value = call(target, selector);

		return typeof value === 'string' ? value : undefined;
	}

	function number(target: Handle, selector: string): number {
		const value = call(target, selector);

		if (typeof value === 'bigint') return Number(value);

		return typeof value === 'number' ? value : Number(value) || 0;
	}

	function attributes(text: Handle, index: number): TextAttributes | null {
		return call(
			text,
			'attributesAtIndex:effectiveRange:',
			index,
			null,
		) as TextAttributes | null;
	}

	// Returns every class in order, or `null` when any is missing.
	function classes(...names: string[]): Handle[] | null {
		const found = names
			.map((name) => objc.getClass(name))
			.filter((value): value is Handle => value !== null);

		return found.length === names.length ? found : null;
	}

	function setValues(target: Handle, values: KeyValues) {
		for (const [key, value] of Object.entries(values))
			call(target, 'setValue:forKey:', value, key);
	}

	function range(location: number, length: number): Handle {
		return objc.struct('NSRange', { location, length });
	}

	return { objc, call, handle, string, number, attributes, classes, setValues, range };
}

export default createBridge;
