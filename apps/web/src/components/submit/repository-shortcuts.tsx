import type { PushableRepository } from '@unbound-app/contracts/source';
import { AnimatePresence, MotionConfig, motion } from 'motion/react';
import type { Transition } from 'motion/react';
import { IconPlus } from 'nucleo-micro-bold';
import type { ReactNode } from 'react';

import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from '~/components/ui/dropdown-menu';
import { repositoryAddonsQuery } from '~/queries/submissions/submissions';
import MorphHeight, { MORPH_EXPO } from '~/components/addon-filters/morph-height';
import usePrefetchIntent from '~/queries/use-prefetch-intent';
import { Button } from '~/components/ui/button';
import Avatar from '~/components/ui/avatar';
import Text from '~/components/ui/text';

type RepositoryShortcutsProps = {
	/** Ranked by how likely each holds addons. */
	repositories: PushableRepository[];
	/** What the author has typed, a URL or part of `owner/name`. */
	query: string;
	disabled: boolean;
	onPick: (repository: string) => void;
};

type OwnerAvatarProps = {
	entry: PushableRepository;
};

type RepositoryShortcutProps = {
	entry: PushableRepository;
	disabled: boolean;
	onPick: () => void;
};

type MoreRepositoriesProps = {
	repositories: PushableRepository[];
	disabled: boolean;
	onPick: (repository: string) => void;
};

type PillProps = {
	children: ReactNode;
};

// The best guesses stay one click away; the rest wait in a menu.
const SHORTCUT_LIMIT = 12;

// The site's `--ease-out` over MORPH_EXPO's 280ms, so the pills settle with the card's height.
const LAYOUT: Transition = { duration: 0.28, ease: [0.23, 1, 0.32, 1] };
const HIDDEN = { opacity: 0, scale: 0.9, filter: 'blur(4px)' };
const SHOWN = { opacity: 1, scale: 1, filter: 'blur(0px)' };

const GITHUB_PREFIX = /^(?:https?:\/\/)?(?:www\.)?github\.com\//;

function normalize(query: string): string {
	return query
		.trim()
		.toLowerCase()
		.replace(GITHUB_PREFIX, '')
		.replace(/\.git$/, '');
}

function OwnerAvatar({ entry }: OwnerAvatarProps) {
	return (
		<Avatar
			src={entry.ownerAvatarUrl}
			fallback={entry.repository.charAt(0).toUpperCase()}
			alt=''
			className='rounded-[5px] size-4.5 font-semibold text-[10px]'
		/>
	);
}

function Pill({ children }: PillProps) {
	return (
		<motion.div layout initial={HIDDEN} animate={SHOWN} exit={HIDDEN}>
			{children}
		</motion.div>
	);
}

function RepositoryShortcut({ entry, disabled, onPick }: RepositoryShortcutProps) {
	const prefetch = usePrefetchIntent(repositoryAddonsQuery({ repository: entry.repository }));

	return (
		<Button
			type='button'
			variant='outline'
			size='sm'
			disabled={disabled}
			onClick={onPick}
			{...prefetch}
		>
			<OwnerAvatar entry={entry} />
			{entry.repository}
		</Button>
	);
}

function MoreRepositories({ repositories, disabled, onPick }: MoreRepositoriesProps) {
	return (
		<DropdownMenu>
			<DropdownMenuTrigger asChild>
				<Button
					type='button'
					variant='outline'
					size='sm'
					disabled={disabled}
					aria-label={`${repositories.length} more repositories`}
				>
					<IconPlus size={12} />
					{repositories.length}
				</Button>
			</DropdownMenuTrigger>
			<DropdownMenuContent align='start' className='w-72 max-h-72'>
				{repositories.map((entry) => (
					<DropdownMenuItem
						key={entry.repository}
						onClick={() => onPick(entry.repository)}
					>
						<OwnerAvatar entry={entry} />
						<span className='truncate'>{entry.repository}</span>
					</DropdownMenuItem>
				))}
			</DropdownMenuContent>
		</DropdownMenu>
	);
}

/**
 * @description The repositories the author can push to as one-click pills, filtered by what they type.
 * @param props The ranked repositories, the typed query and what picking one does.
 * @returns The labelled pills, with the overflow in a menu.
 */
function RepositoryShortcuts({ repositories, query, disabled, onPick }: RepositoryShortcutsProps) {
	const needle = normalize(query);
	const matches = needle
		? repositories.filter((entry) => entry.repository.toLowerCase().includes(needle))
		: repositories;
	const shown = matches.slice(0, SHORTCUT_LIMIT);
	const rest = matches.slice(SHORTCUT_LIMIT);

	// MorphHeight grows the card with the pills; the padding inside its clip keeps focus rings whole.
	return (
		<MotionConfig transition={LAYOUT} reducedMotion='user'>
			<div className='-m-1'>
				<MorphHeight config={MORPH_EXPO}>
					<div className='flex flex-col gap-2 p-1'>
						<Text variant='text-xs' color='muted'>
							{matches.length > 0
								? 'Repositories you can push to'
								: 'None of your repositories match'}
						</Text>
						<div className='flex flex-wrap gap-2'>
							<AnimatePresence mode='popLayout' initial={false}>
								{shown.map((entry) => (
									<Pill key={entry.repository}>
										<RepositoryShortcut
											entry={entry}
											disabled={disabled}
											onPick={() => onPick(entry.repository)}
										/>
									</Pill>
								))}
								{rest.length > 0 ? (
									<Pill key='more'>
										<MoreRepositories
											repositories={rest}
											disabled={disabled}
											onPick={onPick}
										/>
									</Pill>
								) : null}
							</AnimatePresence>
						</div>
					</div>
				</MorphHeight>
			</div>
		</MotionConfig>
	);
}

export default RepositoryShortcuts;
