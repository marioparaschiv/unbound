import { openSheet } from '@unbound-plugins/shared/action-sheets/open-sheet';
import { Discord } from '@unbound-app/api/metro/components';
import { format, messages } from '@unbound-app/i18n';
import { ScrollView, View } from 'react-native';
import { useEffect, useState } from 'react';

import { formatSize, listZip, type ZipEntry } from '~/lib/zip';

const MAX_HEIGHT = 520;

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
	if (!entries.length)
		return <Discord.Text variant='text-md/normal'>{messages.EMPTY_ZIP}</Discord.Text>;

	return (
		<View style={{ gap: 8 }}>
			<Discord.Text variant='text-sm/medium' color='text-muted'>
				{format('FILE_COUNT', { count: entries.length })}
			</Discord.Text>
			<ScrollView style={{ maxHeight: MAX_HEIGHT }} nestedScrollEnabled>
				{entries.map((entry, index) => (
					<View
						key={`${entry.name}-${index}`}
						style={{ flexDirection: 'row', gap: 12, paddingVertical: 4 }}
					>
						<Discord.Text
							variant='text-sm/normal'
							style={{ flex: 1 }}
							numberOfLines={2}
						>
							{entry.name}
						</Discord.Text>
						<Discord.Text variant='text-sm/normal' color='text-muted'>
							{formatSize(entry.size)}
						</Discord.Text>
					</View>
				))}
			</ScrollView>
		</View>
	);
}

function PreviewSheet({ name, url }: PreviewSheetProps) {
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
		<Discord.ActionSheet>
			<View style={{ gap: 12, padding: 16 }}>
				<Discord.Text variant='heading-lg/semibold' numberOfLines={2}>
					{name}
				</Discord.Text>
				{loaded.state === 'loading' ? (
					<Discord.Text variant='text-md/normal'>{messages.LOADING}</Discord.Text>
				) : null}
				{loaded.state === 'failed' ? (
					<Discord.Text variant='text-md/normal'>{loaded.message}</Discord.Text>
				) : null}
				{loaded.state === 'listed' ? <EntryList entries={loaded.entries} /> : null}
			</View>
		</Discord.ActionSheet>
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
