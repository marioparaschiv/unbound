import { getActionSheetRow } from '@unbound-plugins/shared/action-sheets/action-sheet-row';
import type { SheetProps } from '@unbound-plugins/shared/action-sheets/open-sheet';
import { Discord } from '@unbound-app/api/metro/components';
import { format, messages } from '@unbound-app/i18n';
import { assets } from '@unbound-app/api';
import { useEffect, useState } from 'react';
import { Dimensions, Image, View } from 'react-native';

import type { ArchiveEntry, Comic, ComicRequest } from '~/lib/comics';
import { searchArchive } from '~/lib/comics';
import { shareComic } from '~/lib/share';
import { xkcd } from '~/lib/client';

type ComicSheetProps = SheetProps & { request: ComicRequest };

type Shown =
	| { state: 'loading' }
	| { state: 'failed' }
	| { state: 'missing' }
	| { state: 'results'; query: string; results: ArchiveEntry[] }
	| { state: 'comic'; comic: Comic; latest: number };

async function randomNumber(): Promise<number | undefined> {
	const latest = await xkcd.latest();

	return latest ? 1 + Math.floor(Math.random() * latest) : undefined;
}

async function load(request: ComicRequest): Promise<Shown> {
	if (request.kind === 'search') {
		const results = searchArchive(await xkcd.archive(), request.query);

		if (results.length === 1) return load({ kind: 'number', num: results[0]!.num });

		return results.length
			? { state: 'results', query: request.query, results }
			: { state: 'missing' };
	}

	const num =
		request.kind === 'number'
			? request.num
			: request.kind === 'random'
				? await randomNumber()
				: undefined;
	const [comic, latest] = await Promise.all([xkcd.comic(num), xkcd.latest()]);

	return comic && latest ? { state: 'comic', comic, latest } : { state: 'missing' };
}

function ComicImage({ comic }: { comic: Comic }) {
	const width = Dimensions.get('window').width - 32;
	const [height, setHeight] = useState(width * 0.6);

	useEffect(() => {
		Image.getSize(comic.img, (w, h) => w > 0 && setHeight((width * h) / w));
	}, [comic.img, width]);

	return (
		<Image
			source={{ uri: comic.img }}
			resizeMode='contain'
			accessibilityLabel={comic.alt}
			style={{
				width,
				height: Math.min(height, Dimensions.get('window').height * 0.55),
				alignSelf: 'center',
				backgroundColor: 'white',
				borderRadius: 8,
			}}
		/>
	);
}

/**
 * @description Shows an xkcd comic with its title and alt text, rows to step through comics or pick a random one, and
 * one to share it; a title search with several matches lists them first.
 * @param props The first comic to show, and how to close the sheet.
 * @returns The sheet.
 */
export default function ComicSheet({ request, onClose }: ComicSheetProps) {
	const [current, setCurrent] = useState<ComicRequest>(request);
	const [shown, setShown] = useState<Shown>({ state: 'loading' });
	const ActionSheetRow = getActionSheetRow();
	const icon = (name: string) => {
		const id = assets.getIdByName(name);

		return id ? <ActionSheetRow.Icon source={id} /> : undefined;
	};

	useEffect(() => {
		let active = true;

		setShown({ state: 'loading' });
		load(current)
			.then((next) => active && setShown(next))
			.catch(() => active && setShown({ state: 'failed' }));

		return () => {
			active = false;
		};
	}, [current]);

	const go = (num: number) => setCurrent({ kind: 'number', num });

	return (
		<Discord.ActionSheet>
			{shown.state === 'loading' || shown.state === 'failed' || shown.state === 'missing' ? (
				<Discord.Text variant='text-md/normal' color='text-muted' style={{ padding: 16 }}>
					{shown.state === 'loading'
						? messages.LOADING
						: shown.state === 'failed'
							? messages.FAILED
							: messages.NOT_FOUND}
				</Discord.Text>
			) : null}
			{shown.state === 'results' ? (
				<>
					<Discord.Text
						variant='text-md/semibold'
						style={{ padding: 16, paddingBottom: 8 }}
					>
						{format('RESULTS', { query: shown.query })}
					</Discord.Text>
					<ActionSheetRow.Group>
						{shown.results.map((entry) => (
							<ActionSheetRow
								key={entry.num}
								label={`#${entry.num} · ${entry.title}`}
								onPress={() => go(entry.num)}
							/>
						))}
					</ActionSheetRow.Group>
				</>
			) : null}
			{shown.state === 'comic' ? (
				<View style={{ gap: 12, paddingBottom: 12 }}>
					<View style={{ paddingHorizontal: 16, gap: 2 }}>
						<Discord.Text variant='heading-lg/bold'>{`#${shown.comic.num} · ${shown.comic.title}`}</Discord.Text>
						<Discord.Text variant='text-xs/normal' color='text-muted'>
							{shown.comic.date}
						</Discord.Text>
					</View>
					<ComicImage comic={shown.comic} />
					<Discord.Text
						variant='text-sm/normal'
						color='text-muted'
						style={{ paddingHorizontal: 16 }}
					>
						{shown.comic.alt}
					</Discord.Text>
					<ActionSheetRow.Group>
						<ActionSheetRow
							label={messages.PREVIOUS}
							icon={icon('ArrowLargeLeftIcon')}
							disabled={shown.comic.num <= 1}
							onPress={() => go(shown.comic.num - 1)}
						/>
						<ActionSheetRow
							label={messages.NEXT}
							icon={icon('ArrowLargeRightIcon')}
							disabled={shown.comic.num >= shown.latest}
							onPress={() => go(shown.comic.num + 1)}
						/>
						<ActionSheetRow
							label={messages.RANDOM}
							icon={icon('DiceIcon')}
							onPress={() => setCurrent({ kind: 'random' })}
						/>
						<ActionSheetRow
							label={messages.SHARE}
							icon={icon('ShareIcon')}
							onPress={() => shareComic(shown.comic.num) && onClose()}
						/>
					</ActionSheetRow.Group>
				</View>
			) : null}
		</Discord.ActionSheet>
	);
}
