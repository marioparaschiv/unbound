import type { ReactNode } from 'react';

import CursorPager from '~/components/admin/cursor-pager';
import { Card } from '~/components/ui/card';

type TableCardProps = {
	/** The search and filters, in the card's header. */
	toolbar: ReactNode;
	columns: string[];
	empty: boolean;
	/** The plural noun of the rows, e.g. `users`. */
	noun: string;
	next: string | null;
	prev: string | null;
	children: ReactNode;
};

const HEADER_CLASS = 'px-4 py-2.5 font-medium text-muted-foreground text-xs text-left';

/**
 * @description One card holding a list's search and filters, its table and its pager.
 * @param props The toolbar, the column headings, the rows and the page cursors.
 * @returns The card.
 */
function TableCard({ toolbar, columns, empty, noun, next, prev, children }: TableCardProps) {
	return (
		<Card className='gap-0 py-0 overflow-hidden'>
			<div className='flex flex-col gap-3 px-4 py-3 border-b'>{toolbar}</div>
			<div className='overflow-x-auto'>
				<table className='w-full'>
					<thead className='border-b border-border'>
						<tr>
							{columns.map((column) => (
								<th key={column} className={HEADER_CLASS}>
									{column}
								</th>
							))}
						</tr>
					</thead>
					<tbody className='divide-y divide-border'>
						{empty ? (
							<tr>
								<td
									colSpan={columns.length}
									className='px-4 py-10 text-muted-foreground text-sm text-center'
								>
									No {noun} found.
								</td>
							</tr>
						) : (
							children
						)}
					</tbody>
				</table>
			</div>
			<CursorPager next={next} prev={prev} />
		</Card>
	);
}

export default TableCard;
