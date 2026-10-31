import { createContext, useContext, useLayoutEffect, useRef, useState } from 'react';
import { Slot, Slottable } from '@radix-ui/react-slot';
import type { ComponentProps, RefObject } from 'react';

import cn from '~/lib/cn';

type SegmentedTone = 'card' | 'header';

type SegmentedContextValue = {
	active: string | null;
	highlighted: string | null;
	setHovered: (value: string | null) => void;
	/** Where the pill was as it left an item, for one mounting in the same commit to slide from. */
	lastPill: RefObject<DOMRect | null>;
};

type SegmentedProps = ComponentProps<'nav'> & {
	value: string | null;
	tone?: SegmentedTone;
};

type SegmentedItemProps = ComponentProps<'a'> & {
	value: string;
	asChild?: boolean;
};

// Hovering is frequent, so the pill answers at once with a strong ease-out instead of easing in.
const PILL_TIMING: KeyframeAnimationOptions = {
	duration: 250,
	easing: 'cubic-bezier(0.23, 1, 0.32, 1)',
};

// Each tone names its surface and pill tokens, so the header and page variants share every class.
const TONES: Record<SegmentedTone, string> = {
	card: '[--segmented-bg:var(--card)] [--segmented-pill:var(--accent)]',
	header: '[--segmented-bg:var(--header)] [--segmented-pill:var(--header-pill)]',
};

const SegmentedContext = createContext<SegmentedContextValue | null>(null);

function useSegmented() {
	const context = useContext(SegmentedContext);

	if (!context) {
		throw new Error('SegmentedItem must be rendered inside Segmented.');
	}

	return context;
}

// One pill per control, moved by unmounting it from one item and mounting it in the next: it slides from the old
// box by animating its insets, so it keeps its true size and corner radius throughout.
function SegmentedPill() {
	const { lastPill } = useSegmented();
	const ref = useRef<HTMLSpanElement>(null);

	useLayoutEffect(() => {
		const pill = ref.current;

		if (!pill) return;

		const from = lastPill.current;
		const to = pill.getBoundingClientRect();

		if (from) {
			pill.animate(
				{
					top: [`${from.top - to.top}px`, '0px'],
					right: [`${to.right - from.right}px`, '0px'],
					bottom: [`${to.bottom - from.bottom}px`, '0px'],
					left: [`${from.left - to.left}px`, '0px'],
				},
				PILL_TIMING,
			);
		}

		// Read mid-slide, so an interrupted slide continues from where it is. Only a pill mounting in this same
		// commit slides from it; a later one appears in place.
		return () => {
			lastPill.current = pill.getBoundingClientRect();
			queueMicrotask(() => {
				lastPill.current = null;
			});
		};
	}, [lastPill]);

	return (
		<span
			ref={ref}
			data-slot='segmented-pill'
			className='-z-10 absolute inset-0 rounded-inner bg-(--segmented-pill) shadow-key pointer-events-none'
		/>
	);
}

/**
 * @description A capsule of links where one soft pill marks the hovered item, or the active one at rest.
 * @param props The nav's props, the active item's value and the surface tone.
 * @returns The segmented control.
 */
function Segmented({ value, tone = 'card', className, onMouseLeave, ...props }: SegmentedProps) {
	const [hovered, setHovered] = useState<string | null>(null);
	const lastPill = useRef<DOMRect | null>(null);

	return (
		<SegmentedContext.Provider
			value={{ active: value, highlighted: hovered ?? value, setHovered, lastPill }}
		>
			<nav
				data-slot='segmented'
				className={cn(
					'isolate flex items-center gap-0.5 bg-(--segmented-bg) shadow-surface p-1 rounded-control ring-1 ring-border ring-inset w-max h-(--control-h)',
					TONES[tone],
					className,
				)}
				onMouseLeave={(event) => {
					setHovered(null);
					onMouseLeave?.(event);
				}}
				{...props}
			/>
		</SegmentedContext.Provider>
	);
}

/**
 * @description One item of a Segmented control; pass a router link through `asChild`.
 * @param props The item's props, its value and whether to render the child element instead of an anchor.
 * @returns The segmented item.
 */
function SegmentedItem({
	value,
	asChild = false,
	className,
	children,
	onMouseEnter,
	...props
}: SegmentedItemProps) {
	const { active, highlighted, setHovered } = useSegmented();
	const Component = asChild ? Slot : 'a';

	// Labels sit at z-10 so a sliding pill stays under them, even inside a pressed item scaled into its own layer.
	return (
		<Component
			data-slot='segmented-item'
			data-active={value === active}
			className={cn(
				'inline-flex relative items-center px-3.5 rounded-inner outline-none focus-visible:ring-[3px] focus-visible:ring-halo h-9 font-semibold text-muted-foreground hover:text-foreground data-[active=true]:text-foreground transition-colors cursor-pointer press-flat [&>:not([data-slot=segmented-pill])]:relative [&>:not([data-slot=segmented-pill])]:z-10',
				className,
			)}
			onMouseEnter={(event) => {
				setHovered(value);
				onMouseEnter?.(event);
			}}
			{...props}
		>
			{value === highlighted ? <SegmentedPill /> : null}
			<Slottable>{children}</Slottable>
		</Component>
	);
}

export { Segmented, SegmentedItem };

export default { Segmented, SegmentedItem };
