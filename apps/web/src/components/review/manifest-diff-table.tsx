import type { ReviewEntry } from '~/lib/review-entry';
import cn from '~/lib/cn';

type ManifestDiffTableProps = {
	entry: ReviewEntry;
};

function ManifestDiffTable({ entry }: ManifestDiffTableProps) {
	const { previousVersion } = entry;

	return (
		<div className='border border-border rounded-control overflow-x-auto'>
			<table className='w-full text-sm'>
				<thead className='bg-muted/50 border-b border-border text-muted-foreground'>
					<tr>
						<th className='px-3 py-2 font-medium text-left'>Field</th>
						{previousVersion ? (
							<th className='px-3 py-2 font-medium text-left'>
								Approved {previousVersion}
							</th>
						) : null}
						<th className='px-3 py-2 font-medium text-left'>Submitted</th>
					</tr>
				</thead>
				<tbody className='divide-y divide-border'>
					{entry.fields.map((row) => (
						<tr key={row.field} className={cn(row.changed && 'bg-primary/5')}>
							<td className='px-3 py-2 font-medium whitespace-nowrap align-top'>
								{row.field}
								{row.changed ? (
									<span className='ml-2 font-semibold text-[10px] text-primary uppercase'>
										Changed
									</span>
								) : null}
							</td>
							{previousVersion ? (
								<td className='px-3 py-2 font-mono text-muted-foreground text-xs break-all align-top'>
									{row.previous ?? 'Not set'}
								</td>
							) : null}
							<td className='px-3 py-2 font-mono text-xs break-all align-top'>
								{row.next ?? 'Not set'}
							</td>
						</tr>
					))}
				</tbody>
			</table>
		</div>
	);
}

export default ManifestDiffTable;
