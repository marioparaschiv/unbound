import { IconFile, IconFolder } from 'nucleo-micro-bold';
import type { ReactNode } from 'react';

type FileTreeProps = {
	children: ReactNode;
};

type EntryProps = {
	name: string;
	/** What the file or folder holds; wraps under the name on phones. */
	note?: string;
};

type FolderProps = EntryProps & {
	children?: ReactNode;
};

function EntryRow({ name, note, icon: Glyph }: EntryProps & { icon: typeof IconFile }) {
	return (
		<div className='flex sm:flex-row flex-col sm:items-baseline gap-x-3 gap-y-0.5 py-1'>
			<span className='flex items-center gap-2 font-mono text-[0.8125rem] text-foreground shrink-0'>
				<Glyph aria-hidden className='size-3.5 text-muted-foreground shrink-0' />
				{name}
			</span>
			{note ? (
				<span className='pl-5.5 sm:pl-0 text-muted-foreground text-xs leading-5'>
					{note}
				</span>
			) : null}
		</div>
	);
}

/**
 * @description A folder layout drawn as an indented tree, each entry with an optional note.
 * @param props The top-level `Folder` and `File` entries.
 * @returns The tree.
 */
export function FileTree({ children }: FileTreeProps) {
	return (
		<ul className='bg-muted/60 px-4 py-3 border rounded-control min-w-0 overflow-x-auto'>
			{children}
		</ul>
	);
}

/**
 * @description A folder in a {@link FileTree}; its children are indented under it.
 * @param props The folder's name, note and entries.
 * @returns The folder.
 */
export function Folder({ name, note, children }: FolderProps) {
	return (
		<li>
			<EntryRow name={name} note={note} icon={IconFolder} />
			{children ? <ul className='ml-1.5 pl-4 border-border border-l'>{children}</ul> : null}
		</li>
	);
}

/**
 * @description A file in a {@link FileTree}.
 * @param props The file's name and note.
 * @returns The file.
 */
export function File({ name, note }: EntryProps) {
	return (
		<li>
			<EntryRow name={name} note={note} icon={IconFile} />
		</li>
	);
}

export default { FileTree, Folder, File };
