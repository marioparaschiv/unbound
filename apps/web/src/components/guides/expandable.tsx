import { IconChevronRight } from 'nucleo-micro-bold';
import type { ReactNode } from 'react';

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
		<details className='group/expandable border rounded-control'>
			<summary className='flex items-center gap-2 px-3 h-9 font-medium text-foreground text-sm cursor-pointer list-none [&::-webkit-details-marker]:hidden select-none'>
				<IconChevronRight className='size-3.5 text-muted-foreground group-open/expandable:rotate-90 transition-transform' />
				<span className='group-open/expandable:hidden'>Show {title}</span>
				<span className='hidden group-open/expandable:inline'>Hide {title}</span>
			</summary>
			<div className='px-4 pt-3 pb-1 border-t'>{children}</div>
		</details>
	);
}

export default Expandable;
