import { useCallback, useDeferredValue, useId, useMemo, useState } from 'react';
import { Link, useRouteContext } from '@tanstack/react-router';
import { IconDownload } from 'nucleo-micro-bold';
import { toast } from 'sonner';

import {
	buildOverrideSemantic,
	getOverrideDefaults,
	type OverrideValues,
} from '~/lib/theme-maker/advanced-overrides';
import { buildThemeFiles, validateThemeFiles, zipThemeFiles } from '~/lib/theme-maker/theme-files';
import { Field, FieldDescription, FieldGroup, FieldLabel } from '~/components/ui/field';
import { generateRaws, type ThemeBase, type ThemeColors } from '~/lib/theme-maker/ramp';
import { DISCORD_RAWS, getSceneColors } from '~/lib/theme-maker/scene-colors';
import { DEFAULT_PRESET, THEME_PRESETS } from '~/lib/theme-maker/presets';
import AdvancedColors from '~/components/theme-maker/advanced-colors';
import { getMentionSemantic } from '~/lib/theme-maker/theme-semantic';
import { Segmented, SegmentedItem } from '~/components/ui/segmented';
import { SubmitSection } from '~/components/submit/submit-section';
import ThemePreview from '~/components/theme-maker/theme-preview';
import ColorField from '~/components/theme-maker/color-field';
import RampStrips from '~/components/theme-maker/ramp-strips';
import { Button } from '~/components/ui/button';
import { Card } from '~/components/ui/card';
import Input from '~/components/ui/input';
import Text from '~/components/ui/text';
import cn from '~/lib/cn';

type Mode = 'simple' | 'advanced';

const COLOR_FIELDS: { key: keyof ThemeColors; label: string; description: string }[] = [
	{ key: 'background', label: 'Background', description: 'Backgrounds, surfaces and text.' },
	{ key: 'accent', label: 'Accent', description: 'Buttons, switches and your reactions.' },
	{ key: 'mention', label: 'Mentions', description: '@mentions and messages that mention you.' },
];

const MODES: { value: Mode; label: string }[] = [
	{ value: 'simple', label: 'Simple' },
	{ value: 'advanced', label: 'Advanced' },
];

const LINK = 'text-link hover:underline underline-offset-4';

function downloadFile(bytes: Uint8Array<ArrayBuffer>, filename: string) {
	const url = URL.createObjectURL(new Blob([bytes], { type: 'application/zip' }));
	const anchor = document.createElement('a');

	anchor.href = url;
	anchor.download = filename;
	anchor.click();
	URL.revokeObjectURL(url);
}

/**
 * @description The theme maker: a base, three colours, optional advanced overrides, a live phone preview and the
 * download.
 * @returns The theme maker.
 */
function ThemeMaker() {
	const id = useId();
	const session = useRouteContext({ from: '__root__', select: (context) => context.session });
	const [base, setBase] = useState<ThemeBase>(DEFAULT_PRESET.base);
	const [colors, setColors] = useState<ThemeColors>(DEFAULT_PRESET.colors);
	const [mode, setMode] = useState<Mode>('simple');
	const [overrides, setOverrides] = useState<OverrideValues>({});
	const [name, setName] = useState('My Theme');
	const [authorName, setAuthorName] = useState(session?.user.name ?? '');
	const [authorId, setAuthorId] = useState('');
	// A dragged picker fires on every frame; the preview catches up when the input is idle.
	const deferredBase = useDeferredValue(base);
	const deferredColors = useDeferredValue(colors);
	const deferredOverrides = useDeferredValue(mode === 'advanced' ? overrides : null);
	const raws = useMemo(
		() => generateRaws(DISCORD_RAWS, deferredColors, deferredBase),
		[deferredColors, deferredBase],
	);
	const mentionSemantic = useMemo(() => getMentionSemantic(deferredBase), [deferredBase]);
	const overrideDefaults = useMemo(
		() => getOverrideDefaults(raws, deferredBase, mentionSemantic),
		[raws, deferredBase, mentionSemantic],
	);
	// Simple mode keeps the overrides for a switch back, but neither previews nor ships them.
	const semantic = useMemo(
		() =>
			deferredOverrides
				? {
						...mentionSemantic,
						...buildOverrideSemantic(
							deferredOverrides,
							raws,
							deferredBase,
							mentionSemantic,
						),
					}
				: mentionSemantic,
		[deferredOverrides, raws, deferredBase, mentionSemantic],
	);
	const sceneColors = useMemo(
		() => getSceneColors(raws, deferredBase, semantic),
		[raws, deferredBase, semantic],
	);
	const files = useMemo(
		() => buildThemeFiles({ name, authorName, authorId }, raws, deferredBase, semantic),
		[name, authorName, authorId, raws, deferredBase, semantic],
	);
	const errors = validateThemeFiles(files);
	const setOverride = useCallback((key: string, value: string | undefined) => {
		setOverrides((current) => {
			const rest = Object.fromEntries(Object.entries(current).filter(([id]) => id !== key));

			return value ? { ...rest, [key]: value } : rest;
		});
	}, []);

	function download() {
		downloadFile(zipThemeFiles(files), `${files.folder}.zip`);
		toast.success(`Downloaded ${files.manifest.name}`);
	}

	return (
		// The preview column is the 360px phone plus the card's padding and border, so its padding is even on all sides.
		<div className='items-start gap-6 grid lg:grid-cols-[1fr_calc(360px+2*var(--card-pad)+2px)]'>
			<div className='flex flex-col gap-6 min-w-0'>
				<SubmitSection
					title='Base'
					description={
						<>
							The Discord theme yours builds on, saved as the bundle&apos;s{' '}
							<span className='font-mono'>type</span>. Anything your theme
							doesn&apos;t change falls back to this base&apos;s colors. Picking one
							also resets the three colors to its own.
						</>
					}
				>
					<div className='-m-1 p-1 overflow-x-auto hide-scrollbar'>
						<Segmented
							value={
								THEME_PRESETS.find((preset) => preset.base === base)?.name ?? null
							}
							aria-label='Base'
						>
							{THEME_PRESETS.map((preset) => (
								<SegmentedItem key={preset.name} value={preset.name} asChild>
									<button
										type='button'
										className='gap-2 whitespace-nowrap'
										aria-pressed={base === preset.base}
										onClick={() => {
											setBase(preset.base);
											setColors(preset.colors);
										}}
									>
										{/* The base's chat background, the colour that dominates it; the ring keeps the darkest visible. */}
										<span
											className='rounded-full ring-1 ring-border size-3.5 shrink-0'
											style={{ background: preset.colors.background }}
										/>
										<span>{preset.name}</span>
									</button>
								</SegmentedItem>
							))}
						</Segmented>
					</div>
				</SubmitSection>

				<SubmitSection
					title='Colors'
					description={
						mode === 'simple'
							? 'Every shade Discord uses is generated from these three.'
							: 'The three colors generate every shade; the overrides below replace single parts of Discord on top.'
					}
				>
					<div className='flex flex-col gap-6'>
						<div className='-m-1 p-1 overflow-x-auto hide-scrollbar'>
							<Segmented value={mode} aria-label='Mode'>
								{MODES.map((entry) => (
									<SegmentedItem key={entry.value} value={entry.value} asChild>
										<button
											type='button'
											aria-pressed={mode === entry.value}
											onClick={() => setMode(entry.value)}
										>
											<span>{entry.label}</span>
										</button>
									</SegmentedItem>
								))}
							</Segmented>
						</div>
						<div className='gap-6 grid sm:grid-cols-3'>
							{COLOR_FIELDS.map((field) => (
								<ColorField
									key={field.key}
									label={field.label}
									description={field.description}
									value={colors[field.key]}
									onChange={(value) =>
										setColors((current) => ({ ...current, [field.key]: value }))
									}
								/>
							))}
						</div>
					</div>
				</SubmitSection>

				{mode === 'advanced' ? (
					<SubmitSection
						title='Overrides'
						description='Set any of these to replace that part of Discord. Translucent parts keep their opacity, and reset goes back to the generated color.'
					>
						<AdvancedColors
							defaults={overrideDefaults}
							overrides={overrides}
							onChange={setOverride}
						/>
					</SubmitSection>
				) : null}

				<SubmitSection
					title='Shades'
					description="Discord's color ramps, re-anchored on your colors."
				>
					<RampStrips raws={raws} />
				</SubmitSection>

				<SubmitSection
					title='Download'
					description={
						<>
							A zip of the theme&apos;s folder, with its manifest.json and
							bundle.json. Add the folder to a GitHub repository, then{' '}
							<Link to='/submit' className={LINK}>
								submit it
							</Link>
							.
						</>
					}
					footer={
						<Button
							onClick={download}
							disabled={errors.length > 0}
							className='w-full sm:w-auto'
						>
							<IconDownload size={24} />
							Download Theme
						</Button>
					}
				>
					<FieldGroup className='gap-6'>
						<Field>
							<FieldLabel htmlFor={`${id}-name`}>Name</FieldLabel>
							<Input
								id={`${id}-name`}
								value={name}
								maxLength={64}
								onChange={(event) => setName(event.target.value)}
							/>
							<FieldDescription>
								Title case, like <span className='font-mono'>Rosie Pink</span>.
							</FieldDescription>
						</Field>
						<div className='gap-6 grid sm:grid-cols-2'>
							<Field>
								<FieldLabel htmlFor={`${id}-author`}>Author</FieldLabel>
								<Input
									id={`${id}-author`}
									value={authorName}
									onChange={(event) => setAuthorName(event.target.value)}
								/>
							</Field>
							<Field>
								<FieldLabel htmlFor={`${id}-author-id`}>Discord User ID</FieldLabel>
								<Input
									id={`${id}-author-id`}
									value={authorId}
									inputMode='numeric'
									placeholder='581573474296791211'
									onChange={(event) => setAuthorId(event.target.value)}
								/>
							</Field>
						</div>
						<Text variant='text-sm' color='muted'>
							Theme id{' '}
							<span className='font-mono text-foreground'>{files.manifest.id}</span>
						</Text>
						{errors.length > 0 ? (
							<ul className='flex flex-col gap-1 ml-4 text-destructive text-sm list-disc'>
								{errors.map((error) => (
									<li key={error}>{error[0]?.toUpperCase() + error.slice(1)}.</li>
								))}
							</ul>
						) : null}
						<Text variant='text-sm' color='muted'>
							To tweak it by hand, read{' '}
							<Link
								to='/docs/developer/$'
								params={{ _splat: 'themes/introduction' }}
								className={LINK}
							>
								how themes work
							</Link>
							. With the{' '}
							<Link
								to='/docs/developer/$'
								params={{ _splat: 'tools/debugger' }}
								className={LINK}
							>
								debugger
							</Link>{' '}
							connected,{' '}
							<Link
								to='/docs/developer/$'
								params={{ _splat: 'tools/cli' }}
								className={cn(LINK, 'font-mono')}
							>
								ubd dev
							</Link>{' '}
							reloads the theme on your phone each time you save bundle.json.
						</Text>
					</FieldGroup>
				</SubmitSection>
			</div>

			<aside className='lg:top-6 lg:sticky min-w-0'>
				<Card className='px-(--card-pad)'>
					<ThemePreview colors={sceneColors} />
				</Card>
			</aside>
		</div>
	);
}

export default ThemeMaker;
