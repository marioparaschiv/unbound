import { useLocation } from '@tanstack/react-router';
import type { ReactNode } from 'react';
import { useState } from 'react';

import {
	Accordion as AccordionRoot,
	AccordionContent,
	AccordionItem,
	AccordionTrigger,
} from '~/components/ui/accordion';

type AccordionProps = {
	title: string;
	children: ReactNode;
};

type AccordionGroupProps = {
	children: ReactNode;
};

function slugify(text: string): string {
	return text
		.toLowerCase()
		.replaceAll(/[^a-z0-9]+/g, '-')
		.replaceAll(/^-|-$/g, '');
}

/**
 * @description A question or detail that opens in place; on its own it gets a card, in a group it shares one.
 * Its title is its anchor, as on the old docs site, and linking to that anchor opens it.
 * @param props The title and the content it reveals.
 * @returns The accordion.
 */
export function Accordion({ title, children }: AccordionProps) {
	const id = slugify(title);
	const hash = useLocation({ select: (location) => location.hash });
	const [open, setOpen] = useState(hash === id);
	const [shownHash, setShownHash] = useState(hash);

	if (hash !== shownHash) {
		setShownHash(hash);

		if (hash === id) {
			setOpen(true);
		}
	}

	return (
		<AccordionRoot
			id={id}
			type='single'
			collapsible
			value={open ? 'item' : ''}
			onValueChange={(value) => setOpen(value === 'item')}
			className='scroll-mt-6 bg-card px-4 border rounded-surface shadow-surface [[data-slot=accordion-group]_&]:bg-transparent [[data-slot=accordion-group]_&]:shadow-none [[data-slot=accordion-group]_&]:border-0 [[data-slot=accordion-group]_&]:rounded-none'
		>
			<AccordionItem value='item'>
				<AccordionTrigger className='text-foreground text-base'>{title}</AccordionTrigger>
				<AccordionContent className='flex flex-col gap-3 text-muted-foreground'>
					{children}
				</AccordionContent>
			</AccordionItem>
		</AccordionRoot>
	);
}

/**
 * @description Stacks accordions in one card, divided by rules.
 * @param props The accordions.
 * @returns The group.
 */
export function AccordionGroup({ children }: AccordionGroupProps) {
	return (
		<div
			data-slot='accordion-group'
			className='flex flex-col bg-card border rounded-surface divide-y shadow-surface'
		>
			{children}
		</div>
	);
}

export default { Accordion, AccordionGroup };
