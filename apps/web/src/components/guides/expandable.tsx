import * as AccordionPrimitive from '@radix-ui/react-accordion';
import { IconChevronRight } from 'nucleo-micro-bold';
import type { ReactNode } from 'react';

import { Accordion, AccordionContent, AccordionItem } from '~/components/ui/accordion';

type ExpandableProps = {
	title: string;
	children: ReactNode;
};

/**
 * @description A collapsed group of nested fields, such as the keys of an object parameter.
 * @param props The title and the nested fields.
 * @returns The disclosure.
 */
function Expandable({ title, children }: ExpandableProps) {
	return (
		<Accordion type='single' collapsible className='border rounded-control'>
			<AccordionItem value='item' className='group/expandable'>
				<AccordionPrimitive.Header className='flex'>
					<AccordionPrimitive.Trigger className='flex flex-1 items-center gap-2 px-3 rounded-control outline-none focus-visible:ring-[3px] focus-visible:ring-halo h-9 font-medium text-muted-foreground hover:text-foreground text-sm text-left transition-colors press-flat [--press-depth:0.1]'>
						<IconChevronRight className='size-3.5 group-data-[state=open]/expandable:rotate-90 transition-transform duration-280 ease-expo' />
						<span className='text-foreground'>
							<span className='group-data-[state=open]/expandable:hidden'>
								Show {title}
							</span>
							<span className='hidden group-data-[state=open]/expandable:inline'>
								Hide {title}
							</span>
						</span>
					</AccordionPrimitive.Trigger>
				</AccordionPrimitive.Header>
				<AccordionContent className='px-4 pt-3 pb-1 border-t'>{children}</AccordionContent>
			</AccordionItem>
		</Accordion>
	);
}

export default Expandable;
