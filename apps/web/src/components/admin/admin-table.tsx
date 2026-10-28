import type { ReactNode } from 'react';

import type { CursorPagerProps } from '~/components/admin/cursor-pager';
import CursorPager from '~/components/admin/cursor-pager';

type AdminTableProps = Omit<CursorPagerProps, 'className'> & {
	/** The column headings; an unlabelled actions column follows them. */
	columns: string[];
	/** Whether this page has no rows, which shows a "No {noun} found." row instead. */
	empty: boolean;
	/** The plural noun of the rows, e.g. `users`. */
	noun: string;
	children: ReactNode;
};

const HEADER_CLASS = 'px-4 py-3 font-medium text-muted-foreground text-sm text-left';

function AdminTable({ columns, empty, noun, children, ...pager }: AdminTableProps) {
	return (
		<div className='bg-card shadow-surface border border-border rounded-surface overflow-hidden'>
			<div className='overflow-x-auto'>
				<table className='w-full'>
					<thead className='bg-muted/50 border-b border-border'>
						<tr>
							{columns.map((column) => (
								<th key={column} className={HEADER_CLASS}>
									{column}
								</th>
							))}
							<th className={HEADER_CLASS}>
								<span className='sr-only'>Actions</span>
							</th>
						</tr>
					</thead>
					<tbody className='divide-y divide-border'>
						{empty ? (
							<tr>
								<td
									colSpan={columns.length + 1}
									className='px-4 py-8 text-muted-foreground text-center'
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

			<CursorPager {...pager} />
		</div>
	);
}

export default AdminTable;
