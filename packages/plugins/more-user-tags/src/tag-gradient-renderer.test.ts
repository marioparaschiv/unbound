import { expect, test } from 'bun:test';

import { createTagGradientRenderer } from '@more-user-tags/tag-gradient-renderer';

test('keeps an unchanged tag layer stable across repeated layout callbacks', async () => {
	const handlers = new Map<string, (context: any) => void>();
	const calls: string[] = [];
	const currentCalls: string[] = [];
	let blockText = false;
	let resumeText: (() => void) | null = null;
	const frame = { value: { origin: { x: 0, y: 0 }, size: { width: 42, height: 18 } } };
	const clearColor = { kind: 'color', description: 'UIExtendedGrayColorSpace 0 0' };
	const originalColor = {
		kind: 'color',
		description: 'UIExtendedSRGBColorSpace 0.14 0.5 0.27 1',
	};
	const labelLayer = { kind: 'labelLayer' };
	const gradientLayer = { kind: 'gradientLayer' };
	const parentLayer = { kind: 'parentLayer' };
	const parent = { kind: 'parent' };
	const label = { kind: 'label', background: originalColor, opaque: true };
	const tagView = { kind: 'tagView' };

	const objc = {
		getClass(name: string) {
			if (['CABasicAnimation', 'CAMediaTimingFunction', 'UIAccessibility'].includes(name))
				return null;
			return { kind: name };
		},
		createAssociationKey: () => ({ kind: 'key' }),
		setAssociatedObject: () => {},
		struct: (_name: string, value: unknown) => ({ value }),
		className: (target: any) => (target === label ? 'DCDLabel' : target.kind),
		call(target: any, selector: string) {
			currentCalls.push(`${target.kind}:${selector}`);
			return selector === 'retain' ? target : null;
		},
		invoke() {
			throw new Error('Synchronous main-thread invocation is unavailable');
		},
		async invokeAsync(target: any, selector: string, args: any[]) {
			if (selector === 'text' && blockText)
				await new Promise<void>((resolve) => {
					resumeText = resolve;
				});
			calls.push(`${target.kind}:${selector}`);
			if (selector === 'retain') return target;
			if (selector === 'clearColor') return clearColor;
			if (selector === 'instancesRespondToSelector:') return true;
			if (selector === 'subviews') return [label];
			if (selector === 'hash') return 1;
			if (selector === 'text') return 'Staff';
			if (selector === 'accessibilityLabel') return 'Staff';
			if (selector === 'backgroundColor') return label.background;
			if (selector === 'isOpaque') return label.opaque;
			if (selector === 'superview') return parent;
			if (selector === 'layer') {
				if (target === label) return labelLayer;
				if (target === parent) return parentLayer;
				return gradientLayer;
			}
			if (selector === 'frame' || selector === 'bounds') return frame;
			if (selector === 'cornerRadius') return 4;
			if (selector === 'description') return target.description;
			if (selector === 'isEqual:') return target === args[0];
			if (selector === 'setBackgroundColor:') label.background = args[0];
			if (selector === 'setOpaque:') label.opaque = args[0];
			if (selector === 'colorWithRed:green:blue:alpha:') return { kind: 'color' };
			if (selector === 'CGColor') return { kind: 'cgColor' };
			if (selector === 'arrayWithObject:') return args;
			return null;
		},
		hook(className: string, selector: string, handler: any) {
			handlers.set(`${className}:${selector}`, handler.after);
			return { remove: () => {} };
		},
	};
	const renderer = createTagGradientRenderer({ native: { objc } } as any);
	expect(renderer).not.toBeNull();
	renderer?.setAppearance(['Staff'], { colors: ['#248046'], style: 'solid' });
	const layout = handlers.get('DiscordChat.MessageTagView:layoutSubviews');
	expect(layout).toBeDefined();
	layout?.({ self: tagView });
	await Bun.sleep(10);
	layout?.({ self: tagView });
	await Bun.sleep(10);
	expect(calls.filter((call) => call === 'gradientLayer:setColors:')).toHaveLength(1);
	expect(calls.filter((call) => call === 'gradientLayer:setFrame:')).toHaveLength(1);
	expect(calls.filter((call) => call === 'gradientLayer:setNeedsDisplay')).toHaveLength(1);
	blockText = true;
	layout?.({ self: tagView });
	await Bun.sleep(10);
	let stopped = false;
	const stopping = renderer?.stop().then(() => {
		stopped = true;
	});
	await Bun.sleep(1);
	expect(stopped).toBe(false);
	resumeText?.();
	await stopping;
	expect(stopped).toBe(true);
	expect(calls.filter((call) => call === 'gradientLayer:setColors:')).toHaveLength(1);
	await Bun.sleep(10);
	expect(currentCalls.filter((call) => call === 'label:retain')).toHaveLength(3);
	expect(currentCalls.filter((call) => call === 'label:release')).toHaveLength(3);
	expect(calls).not.toContain('label:retain');
	expect(calls).not.toContain('label:release');
});
