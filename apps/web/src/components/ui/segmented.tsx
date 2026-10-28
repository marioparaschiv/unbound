import { createContext, useContext, useState } from 'react';
import { Slot, Slottable } from '@radix-ui/react-slot';
import type { ComponentProps } from 'react';
import { motion } from 'motion/react';

import cn from '~/lib/cn';

type SegmentedTone = 'card' | 'header';

type SegmentedContextValue = {
	active: string | null;
	highlighted: string | null;
	layoutId: string;
	setHovered: (value: string | null) => void;
};

type SegmentedProps = ComponentProps<'nav'> & {
	value: string | null;
	layoutId: string;
	tone?: SegmentedTone;
};

type SegmentedItemProps = ComponentProps<'a'> & {
	value: string;
	asChild?: boolean;
};

const PILL_TRANSITION = { type: 'spring', stiffness: 500, damping: 38 } as const;

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

/**
 * @description A capsule of links where one soft pill marks the hovered item, or the active one at rest.
 * @param props The nav's props, the active item's value, the pill's shared layout id and the surface tone.
 * @returns The segmented control.
 */
function Segmented({
	value,
	layoutId,
	tone = 'card',
	className,
	onMouseLeave,
	...props
}: SegmentedProps) {
	const [hovered, setHovered] = useState<string | null>(null);

	return (
		<SegmentedContext.Provider
			value={{ active: value, highlighted: hovered ?? value, layoutId, setHovered }}
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
	const { active, highlighted, layoutId, setHovered } = useSegmented();
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
			{value === highlighted ? (
				<motion.span
					data-slot='segmented-pill'
					layoutId={layoutId}
					transition={PILL_TRANSITION}
					className='-z-10 absolute inset-0 rounded-inner bg-(--segmented-pill) shadow-key pointer-events-none'
				/>
			) : null}
			<Slottable>{children}</Slottable>
		</Component>
	);
}

export { Segmented, SegmentedItem };

export default { Segmented, SegmentedItem };
