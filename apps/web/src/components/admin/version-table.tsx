import { formatDate } from '~/components/admin/format-date';
import type { AdminVersion } from '~/lib/admin-addon';
import Tag from '~/components/tag';
import cn from '~/lib/cn';

type VersionTableProps = {
	/** Newest first; the first is the one served. */
	versions: AdminVersion[];
};

const COLUMNS = ['Version', 'Published', 'Min client', 'Size', 'Repository', 'SHA-256'];

const HEADER_CLASS = 'px-4 py-3 font-medium text-muted-foreground text-sm text-left';

const CELL_CLASS = 'px-4 py-3 text-sm whitespace-nowrap';

function formatSize(bytes: number): string {
	return bytes < 1024 ? `${bytes} B` : `${(bytes / 1024).toFixed(1)} KB`;
}

function VersionTable({ versions }: VersionTableProps) {
	return (
		<div className='bg-card border border-border rounded-lg overflow-hidden'>
			<div className='overflow-x-auto'>
				<table className='w-full'>
					<thead className='bg-muted/50 border-b border-border'>
						<tr>
							{COLUMNS.map((column) => (
								<th key={column} className={HEADER_CLASS}>
									{column}
								</th>
							))}
						</tr>
					</thead>
					<tbody className='divide-y divide-border'>
						{versions.length === 0 ? (
							<tr>
								<td
									colSpan={COLUMNS.length}
									className='px-4 py-8 text-muted-foreground text-center'
								>
									No approved versions.
								</td>
							</tr>
						) : null}
						{versions.map((version, index) => (
							<tr key={version.version} className='hover:bg-muted/30'>
								<td className={CELL_CLASS}>
									<span className='inline-flex items-center gap-2'>
										<span className='font-mono'>{version.version}</span>
										{index === 0 ? <Tag variant='primary'>Served</Tag> : null}
									</span>
								</td>
								<td className={cn(CELL_CLASS, 'text-muted-foreground')}>
									{formatDate(version.publishedAt)}
								</td>
								<td className={cn(CELL_CLASS, 'font-mono text-muted-foreground')}>
									{version.minClient ?? 'Any'}
								</td>
								<td className={cn(CELL_CLASS, 'text-muted-foreground')}>
									{formatSize(version.bundleSize)}
								</td>
								<td className={CELL_CLASS}>
									{version.repository ? (
										<a
											href={`https://github.com/${version.repository}`}
											target='_blank'
											rel='noreferrer'
											className='hover:underline'
										>
											{version.repository}
										</a>
									) : (
										<span className='text-muted-foreground'>Unverified</span>
									)}
								</td>
								<td
									className={cn(
										CELL_CLASS,
										'font-mono text-muted-foreground text-xs',
									)}
									title={version.sha256}
								>
									{version.sha256.slice(0, 12)}
								</td>
							</tr>
						))}
					</tbody>
				</table>
			</div>
		</div>
	);
}

export default VersionTable;
