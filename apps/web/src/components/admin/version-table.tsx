import ServeVersionDialog from '~/components/admin/serve-version-dialog';
import { formatDate } from '~/components/admin/format-date';
import type { AdminVersion } from '~/lib/admin-addon';
import Tag from '~/components/tag';
import cn from '~/lib/cn';

type VersionTableProps = {
	addonId: string;
	/** Newest first, withdrawn ones included. */
	versions: AdminVersion[];
	canServe: boolean;
};

type VersionStatusProps = {
	version: AdminVersion;
	served: boolean;
};

const COLUMNS = ['Version', 'Published', 'Min client', 'Size', 'Repository', 'SHA-256'];

const HEADER_CLASS = 'px-4 py-3 font-medium text-muted-foreground text-sm text-left';

const CELL_CLASS = 'px-4 py-3 text-sm whitespace-nowrap';

function formatSize(bytes: number): string {
	return bytes < 1024 ? `${bytes} B` : `${(bytes / 1024).toFixed(1)} KB`;
}

function VersionStatus({ version, served }: VersionStatusProps) {
	const { withdrawal } = version;

	if (served) {
		return <Tag variant='primary'>Served</Tag>;
	}

	if (!withdrawal) return null;

	return (
		<span className='inline-flex items-center gap-2'>
			<Tag variant='destructive'>Withdrawn</Tag>
			<span className='text-muted-foreground text-xs'>
				by rollback #{withdrawal.eventId}
				{withdrawal.by ? ` (${withdrawal.by.name})` : ''} on {formatDate(withdrawal.at)}
			</span>
		</span>
	);
}

function VersionTable({ addonId, versions, canServe }: VersionTableProps) {
	const served = versions.find((version) => !version.withdrawal)?.version;
	const columns = canServe ? [...COLUMNS, ''] : COLUMNS;

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
						</tr>
					</thead>
					<tbody className='divide-y divide-border'>
						{versions.length === 0 ? (
							<tr>
								<td
									colSpan={columns.length}
									className='px-4 py-8 text-muted-foreground text-center'
								>
									No approved versions.
								</td>
							</tr>
						) : null}
						{versions.map((version) => (
							<tr
								key={version.version}
								className={cn(
									'hover:bg-muted/30',
									version.withdrawal && 'opacity-70',
								)}
							>
								<td className={CELL_CLASS}>
									<span className='inline-flex items-center gap-2'>
										<span className='font-mono'>{version.version}</span>
										<VersionStatus
											version={version}
											served={version.version === served}
										/>
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
								{canServe ? (
									<td className={cn(CELL_CLASS, 'text-right')}>
										{version.version === served ? null : (
											<ServeVersionDialog
												addonId={addonId}
												versions={versions}
												version={version.version}
											/>
										)}
									</td>
								) : null}
							</tr>
						))}
					</tbody>
				</table>
			</div>
		</div>
	);
}

export default VersionTable;
