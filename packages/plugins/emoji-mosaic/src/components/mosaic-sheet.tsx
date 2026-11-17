import { openSheet } from '@unbound-plugins/shared/action-sheets/open-sheet';
import { toBase64 } from '@unbound-plugins/shared/media/gif/base64';
import { ActivityIndicator, Image, ScrollView, View } from 'react-native';
import { Discord } from '@unbound-app/api/metro/components';
import type { NativeBridge } from '@unbound-app/api/native';
import { format, messages } from '@unbound-app/i18n';
import { flux, fs, metro, toasts, ui } from '@unbound-app/api';
import { useMemo, useState } from 'react';

import { cleanPrefix, cutTiles, gridFor, mosaicText, MAX_COLUMNS, TILE } from '~/lib/tiles';
import { uploadTargets, uploadTiles } from '~/lib/upload';
import { readImagePixels } from '~/native/pixels';

export type MosaicImage = { url: string; width: number; height: number; filename: string };

type Target = { channelId: string; image: MosaicImage; bridge: NativeBridge; folder: string };

type MosaicSheetProps = Target & { onClose: () => void };

type ChatInputRegistry = {
	getBestActiveInputForChannelId?(channelId: string): { insertText?(text: string): void } | null;
};

async function downloadImage(url: string, folder: string): Promise<string> {
	const response = await fetch(url);

	if (!response.ok) throw new Error(`HTTP ${response.status}`);

	const path = `${folder}/${Date.now()}/source`;

	await fs.writeFile(path, toBase64(new Uint8Array(await response.arrayBuffer())), 'base64');

	return `${fs.documentsPath}/${path}`;
}

function insertMosaic(channelId: string, text: string) {
	const registry = metro.findByProps('getBestActiveInputForChannelId') as
		| ChatInputRegistry
		| undefined;

	registry?.getBestActiveInputForChannelId?.(channelId)?.insertText?.(text);
}

function MosaicSheet({ channelId, image, bridge, folder, onClose }: MosaicSheetProps) {
	const here = flux.getStore('Channel').getChannel(channelId)?.guild_id ?? undefined;
	const targets = useMemo(() => uploadTargets(here), [here]);
	const [columns, setColumns] = useState(3);
	const [prefix, setPrefix] = useState(
		cleanPrefix(image.filename.replace(/\.\w+$/, '')) || 'mosaic',
	);
	const [guildId, setGuildId] = useState(targets[0]?.id);
	const [progress, setProgress] = useState<number>();
	const grid = gridFor(columns, image.width, image.height);
	const count = grid.columns * grid.rows;
	const target = targets.find(({ id }) => id === guildId);
	const name = cleanPrefix(prefix);
	const ready = Boolean(
		target && name.length >= 2 && count <= target.free && progress === undefined,
	);

	async function build() {
		if (!target) return;

		setProgress(0);

		try {
			const path = await downloadImage(image.url, folder);
			const rgba = readImagePixels(bridge, path, grid.columns * TILE, grid.rows * TILE);

			if (!rgba) throw new Error('the image could not be decoded');

			const uploaded = await uploadTiles(target.id, cutTiles(rgba, grid, name), setProgress);

			insertMosaic(channelId, mosaicText(uploaded, grid.columns));
			toasts.success('UPLOADED', { count: uploaded.length, server: target.name });
			onClose();
		} catch (error) {
			logger.error(`Failed to build the emoji mosaic of ${image.url}:`, error);
			toasts.error('FAILED', error);
			setProgress(undefined);
		}
	}

	return (
		<Discord.ActionSheet>
			<ScrollView style={{ maxHeight: 640 }} contentContainerStyle={{ gap: 12, padding: 16 }}>
				<Discord.Text variant='heading-lg/semibold'>{messages.TITLE}</Discord.Text>
				<Image
					source={{ uri: image.url }}
					resizeMode='contain'
					style={{ width: '100%', height: 160, borderRadius: 8 }}
				/>
				<Discord.Text variant='text-md/medium'>
					{format('GRID', { columns: grid.columns, rows: grid.rows, count })}
				</Discord.Text>
				<View style={{ flexDirection: 'row', gap: 8 }}>
					<Discord.Button
						text='−'
						variant='secondary'
						disabled={columns <= 1}
						onPress={() => setColumns(columns - 1)}
					/>
					<Discord.Button
						text='+'
						variant='secondary'
						disabled={columns >= MAX_COLUMNS}
						onPress={() => setColumns(columns + 1)}
					/>
				</View>
				<Discord.TextInput
					description={messages.PREFIX_HELP}
					autoCorrect={false}
					autoCapitalize='none'
					value={prefix}
					onChange={setPrefix}
				/>
				{target && count > target.free ? (
					<Discord.Text variant='text-sm/medium' color='text-danger'>
						{format('TOO_MANY', { count, free: target.free })}
					</Discord.Text>
				) : null}
				{progress === undefined ? (
					<Discord.Button
						text={format('UPLOAD', { count })}
						disabled={!ready}
						onPress={() => void build()}
					/>
				) : (
					<View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
						<ActivityIndicator />
						<Discord.Text variant='text-md/medium'>
							{format('PROGRESS', { done: progress, count })}
						</Discord.Text>
					</View>
				)}
				{targets.length ? (
					<ui.Section title={messages.SERVER}>
						{targets.map((option) => (
							<ui.Row
								key={option.id}
								label={option.name}
								subLabel={format('FREE', { free: option.free })}
								trailing={
									option.id === guildId ? (
										<Discord.Text variant='text-md/semibold'>✓</Discord.Text>
									) : null
								}
								onPress={() => setGuildId(option.id)}
							/>
						))}
					</ui.Section>
				) : (
					<Discord.Text variant='text-md/medium'>{messages.NO_SERVERS}</Discord.Text>
				)}
			</ScrollView>
		</Discord.ActionSheet>
	);
}

/**
 * @description Opens the sheet that cuts an image into emoji tiles and uploads them.
 * @param target The channel, the image, the plugin's native bridge and temporary folder.
 */
export function openMosaicSheet(target: Target): void {
	openSheet(`unbound-emoji-mosaic-${target.image.url}`, MosaicSheet, target);
}

export default MosaicSheet;
