import { getActionSheetRow } from '@unbound-plugins/shared/action-sheets/action-sheet-row';
import { openSheet } from '@unbound-plugins/shared/action-sheets/open-sheet';
import { BottomSheets, Discord, GorhomSheet } from '@unbound-app/api/metro/components';
import { format, messages } from '@unbound-app/i18n';
import { assets } from '@unbound-app/api';
import { useEffect, useState } from 'react';

import { formatSize, listZip, type ZipEntry } from '~/lib/zip';
import { entryIcon, sharedRoot } from '~/lib/entries';
import useStyles from '~/components/preview-sheet.style';

type Target = { name: string; url: string };

type PreviewSheetProps = Target & { onClose: () => void };

type Loaded =
	| { state: 'loading' }
	| { state: 'failed'; message: string }
	| { state: 'listed'; entries: ZipEntry[] };

async function load(url: string): Promise<Loaded> {
	const response = await fetch(url);

	if (!response.ok) return { state: 'failed', message: messages.LOAD_FAILED };

	const entries = listZip(new Uint8Array(await response.arrayBuffer()));

	return entries
		? { state: 'listed', entries }
		: { state: 'failed', message: messages.NOT_A_ZIP };
}

function EntryList({ entries }: { entries: ZipEntry[] }) {
	const ActionSheetRow = getActionSheetRow();
	const root = sharedRoot(entries);

	return (
		<ActionSheetRow.Group hasIcons>
			{entries.map((entry, index) => {
				const icon = assets.getIdByName(entryIcon(entry.name));

				return (
					<ActionSheetRow
						key={`${entry.name}-${index}`}
						label={entry.name.slice(root.length)}
						labelLineClamp={1}
						icon={icon ? <ActionSheetRow.Icon source={icon} /> : undefined}
						trailing={<Discord.TableRow.TrailingText text={formatSize(entry.size)} />}
					/>
				);
			})}
		</ActionSheetRow.Group>
	);
}

function PreviewSheet({ name, url }: PreviewSheetProps) {
	const styles = useStyles();
	const { ActionSheet, BottomSheetTitleHeader } = BottomSheets;
	const { BottomSheetScrollView: ScrollView } = GorhomSheet;
	const [loaded, setLoaded] = useState<Loaded>({ state: 'loading' });

	useEffect(() => {
		let current = true;

		void load(url)
			.catch((error: Error) => {
				logger.error(`Failed to list the files in ${name}:`, error);

				return { state: 'failed', message: messages.LOAD_FAILED } as const;
			})
			.then((result) => current && setLoaded(result));

		return () => {
			current = false;
		};
	}, [url, name]);

	return (
		<ActionSheet scrollable>
			<BottomSheetTitleHeader
				title={name}
				subtitle={
					loaded.state === 'listed'
						? format('FILE_COUNT', { count: loaded.entries.length })
						: undefined
				}
			/>
			{/* A `scrollable` sheet scrolls only a bottom-sheet scroll view, which hands the drag between list and sheet. */}
			<ScrollView contentContainerStyle={styles.body}>
				{loaded.state === 'listed' && loaded.entries.length ? (
					<EntryList entries={loaded.entries} />
				) : (
					<Discord.Text variant='text-md/medium' color='text-muted' style={styles.note}>
						{loaded.state === 'loading'
							? messages.LOADING
							: loaded.state === 'failed'
								? loaded.message
								: messages.EMPTY_ZIP}
					</Discord.Text>
				)}
			</ScrollView>
		</ActionSheet>
	);
}

/**
 * @description Opens a sheet listing the files in a zip archive.
 * @param target The archive's name and URL.
 */
export function openPreviewSheet(target: Target): void {
	openSheet(`unbound-zip-preview-${target.url}`, PreviewSheet, target);
}

export default PreviewSheet;
