import {
	EmojiPicker,
	type CustomCategory,
	type Emoji,
	type EmojiData,
	type EmojiPickerListCategoryHeaderProps,
	type EmojiPickerListEmojiProps,
	type EmojiPickerListRowProps,
} from 'frimousse';
import atlasUrl, { names } from 'virtual:addon-icon-atlas';
import { IconMagnifier } from 'nucleo-micro-bold';
import { createContext, use } from 'react';

import useScrollShield from '~/components/addon-icon-picker/use-scroll-shield';
import AtlasIcon from '~/components/addon-icon-picker/atlas-icon';
import Spinner from '~/components/ui/spinner';
import Text from '~/components/ui/text';
import cn from '~/lib/cn';

type AddonIconPickerProps = {
	/** The icon picked now, highlighted in the grid. */
	value: string | null;
	onSelect: (icon: string) => void;
	/** Shown in the footer while no icon is hovered; left out when there is nothing to reset. */
	onReset?: () => void;
	resetLabel?: string;
	className?: string;
};

function words(name: string): string[] {
	return name.slice('Icon'.length).match(/[A-Z][a-z]*|\d+/g) ?? [];
}

// The grid holds only icons, so the picker's own emoji data is empty and never fetched.
const NO_EMOJIS: EmojiData = {
	locale: 'en',
	emojis: [],
	categories: [],
	skinTones: { light: '', 'medium-light': '', medium: '', 'medium-dark': '', dark: '' },
};

// Frimousse caches resolved data per resolver, so one shared resolver lets every open after the first
// render its grid in the first frame.
function resolveNoEmojis(): EmojiData {
	return NO_EMOJIS;
}

const CATEGORIES: CustomCategory[] = [
	{
		id: 'icons',
		label: 'Icons',
		emojis: names.map((name) => ({
			id: name,
			label: words(name).join(' '),
			url: atlasUrl,
			tags: [name],
		})),
	},
];

// The list renders its cells itself, so the picked icon reaches them through context.
const PickedIcon = createContext<string | null>(null);

function iconName(emoji: Emoji): string {
	return emoji.type === 'custom' ? emoji.id : '';
}

function Row({ children, ...props }: EmojiPickerListRowProps) {
	return (
		<div {...props} className='px-1 scroll-my-1'>
			{children}
		</div>
	);
}

function CategoryHeader({ category, ...props }: EmojiPickerListCategoryHeaderProps) {
	return (
		<div
			{...props}
			className='bg-popover px-3 pt-3.5 pb-2 text-muted-foreground text-xs leading-none'
		>
			{category.label}
		</div>
	);
}

// Cells are plain blocks centred by their line box: flexbox, an overflow clip or resting rounded
// corners cost layout and paint for every row scrolled in. Only the active cell gets a surface.
const CELL =
	'block size-8 cursor-pointer text-center leading-8 text-foreground/85 data-active:rounded-item data-active:bg-accent data-active:text-foreground';

function Icon({ emoji, className, ...props }: EmojiPickerListEmojiProps) {
	const name = iconName(emoji);
	const picked = use(PickedIcon) === name;

	return (
		<button
			{...props}
			aria-label={emoji.label}
			aria-pressed={picked}
			className={cn(
				CELL,
				picked && 'rounded-item bg-primary/15 text-primary data-active:bg-primary/25',
				className,
			)}
		>
			<AtlasIcon name={name} size={18} className='align-middle' />
		</button>
	);
}

/** A searchable grid of every icon a maintainer can pick, drawn from the cached atlas. */
function AddonIconPicker({
	value,
	onSelect,
	onReset,
	resetLabel,
	className,
}: AddonIconPickerProps) {
	const onScroll = useScrollShield();

	return (
		<PickedIcon value={value}>
			<EmojiPicker.Root
				className={cn('isolate flex flex-col bg-popover w-fit h-88', className)}
				columns={9}
				sticky
				categories={CATEGORIES}
				resolveEmojiData={resolveNoEmojis}
				onEmojiSelect={(emoji) => onSelect(iconName(emoji))}
			>
				<div className='flex items-center gap-2 px-3 border-b h-9'>
					<IconMagnifier className='opacity-50 size-3.5 shrink-0' />
					<EmojiPicker.Search
						className='bg-transparent outline-none w-full h-full placeholder:text-muted-foreground text-sm'
						placeholder='Search icons…'
					/>
				</div>
				{/* A standard scrollbar: Chrome repaints a custom thumb on the main thread, behind the grid. */}
				<EmojiPicker.Viewport
					className='relative flex-1 outline-none [scrollbar-color:color-mix(in_oklab,var(--color-foreground)_20%,transparent)_transparent] [scrollbar-width:thin]'
					onScroll={onScroll}
				>
					<div
						className='top-0 z-10 sticky -mb-(--frimousse-viewport-height) h-(--frimousse-viewport-height)'
						data-slot='icon-picker-scroll-shield'
						hidden
					/>
					<EmojiPicker.Loading className='absolute inset-0 flex justify-center items-center text-muted-foreground'>
						<Spinner className='size-4' />
					</EmojiPicker.Loading>
					<EmojiPicker.Empty className='absolute inset-0 flex justify-center items-center'>
						<Text variant='text-sm' color='muted'>
							No icon found.
						</Text>
					</EmojiPicker.Empty>
					<EmojiPicker.List
						className='pb-1 select-none'
						components={{ Row, Emoji: Icon, CategoryHeader }}
					/>
				</EmojiPicker.Viewport>
				<div className='flex items-center gap-1 p-2 border-t w-full max-w-(--frimousse-viewport-width) min-w-0'>
					<EmojiPicker.ActiveEmoji>
						{({ emoji }) =>
							emoji ? (
								<>
									<span className='flex flex-none justify-center items-center size-7'>
										<AtlasIcon name={iconName(emoji)} />
									</span>
									<Text variant='text-xs' className='truncate'>
										{emoji.label}
									</Text>
								</>
							) : onReset ? (
								<button
									type='button'
									onClick={onReset}
									className='hover:bg-accent px-2 rounded-item h-7 text-muted-foreground hover:text-foreground text-xs transition-colors'
								>
									{resetLabel ?? 'Reset'}
								</button>
							) : (
								<Text
									variant='text-xs'
									color='muted'
									className='flex items-center ml-1.5 h-7'
								>
									Select an icon…
								</Text>
							)
						}
					</EmojiPicker.ActiveEmoji>
				</div>
			</EmojiPicker.Root>
		</PickedIcon>
	);
}

export default AddonIconPicker;
