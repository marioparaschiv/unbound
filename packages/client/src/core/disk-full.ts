/** A write the loader could not finish because the device was out of storage. */
export type DiskFullNote = { at: number; file: string };

/**
 * @description Decides whether a disk-full note still needs a warning: once for each note, so a later failed write warns again.
 * @param note The loader's newest disk-full note, if any.
 * @param warnedAt When the note last warned about was written, if one was.
 * @returns Whether to warn.
 */
export function shouldWarnAboutDiskFull(
	note: DiskFullNote | undefined,
	warnedAt: number | undefined,
): note is DiskFullNote {
	return Boolean(note) && note!.at !== warnedAt;
}

/**
 * @description Words the disk-full warning.
 * @param note The disk-full note.
 * @returns The toast's text.
 */
export function diskFullMessage(note: DiskFullNote): string {
	return `Unbound could not save ${note.file} because your phone is out of storage. Free up some space so settings, plugins and updates save again.`;
}
