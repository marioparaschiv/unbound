import { EMBED_MEDIA_FIELDS, SNAPSHOT_FIELDS, SPOILER_LABEL, type BlurPart } from '~/constants';

type Entry = Record<string, unknown>;

export type RowMessage = {
	channelId?: unknown;
	attachments?: unknown;
	embeds?: unknown;
	messageSnapshots?: unknown;
	message_snapshots?: unknown;
};

export type ChatRow = {
	message?: RowMessage;
};

export type RowInput = {
	message?: { channel_id?: unknown };
};

export type BlurParts = Record<BlurPart, boolean>;

type Swap = { original: unknown; blurred: unknown };

type Originals = Partial<Record<BlurPart, Swap>>;

type MediaHolder = Partial<Record<BlurPart, unknown>>;

const MAX_TRACKED = 1000;

function isEntry(value: unknown): value is Entry {
	return typeof value === 'object' && value !== null;
}

function hasValue(value: unknown): boolean {
	return Array.isArray(value) ? value.length > 0 : value !== undefined && value !== null;
}

/**
 * @description Tells whether a chat row embed shows an image, GIF or video.
 * @param embed The embed of a generated chat row.
 * @returns `true` when the embed has media to blur.
 */
export function hasEmbedMedia(embed: unknown): boolean {
	return isEntry(embed) && EMBED_MEDIA_FIELDS.some((field) => hasValue(embed[field]));
}

function isSpoilered(entry: Entry): boolean {
	return entry.isSpoiler === true || (typeof entry.spoiler === 'string' && entry.spoiler !== '');
}

function asSpoilerAttachment(entry: unknown): unknown {
	if (!isEntry(entry) || isSpoilered(entry)) return entry;

	return { ...entry, isSpoiler: true, spoiler: SPOILER_LABEL };
}

function asSpoilerEmbed(entry: unknown): unknown {
	if (!isEntry(entry) || isSpoilered(entry)) return entry;

	return { ...entry, spoiler: SPOILER_LABEL };
}

/**
 * @description Marks every attachment of a chat row as a spoiler, so Discord draws it blurred until tapped.
 * @param attachments The row's attachments.
 * @returns The attachments marked as spoilers, or the value unchanged when it is not a list.
 */
export function blurAttachments(attachments: unknown): unknown {
	return Array.isArray(attachments) ? attachments.map(asSpoilerAttachment) : attachments;
}

/**
 * @description Marks every chat row embed that shows media as a spoiler, so Discord draws it blurred until tapped.
 * @param embeds The row's embeds.
 * @returns The embeds with media marked as spoilers, or the value unchanged when it is not a list.
 */
export function blurEmbeds(embeds: unknown): unknown {
	return Array.isArray(embeds)
		? embeds.map((embed) => (hasEmbedMedia(embed) ? asSpoilerEmbed(embed) : embed))
		: embeds;
}

/**
 * @description Reads the channel a chat row belongs to, from the message it was generated from or the row itself.
 * @param input The input `RowManager.generate` received.
 * @param row The row it generated.
 * @returns The channel id, or `undefined` when neither has one.
 */
export function rowChannelId(
	input: RowInput | undefined,
	row: ChatRow | undefined,
): string | undefined {
	const id = input?.message?.channel_id ?? row?.message?.channelId;

	return typeof id === 'string' ? id : undefined;
}

/**
 * @description Lists the objects of a chat row message that hold attachments and embeds: the message itself and the message of each forwarded snapshot.
 * @param message The row's message.
 * @returns The message followed by each forwarded message it carries.
 */
export function mediaHolders(message: RowMessage | undefined): MediaHolder[] {
	if (!isEntry(message)) return [];

	const holders: MediaHolder[] = [message];

	for (const field of SNAPSHOT_FIELDS) {
		const snapshots = message[field];

		if (!Array.isArray(snapshots)) continue;

		for (const snapshot of snapshots) {
			if (isEntry(snapshot) && isEntry(snapshot.message)) holders.push(snapshot.message);
		}
	}

	return holders;
}

const BLURS: Record<BlurPart, (value: unknown) => unknown> = {
	attachments: blurAttachments,
	embeds: blurEmbeds,
};

const PARTS = Object.keys(BLURS) as BlurPart[];

/**
 * @description Blurs chat rows in place and remembers what it replaced, so a row Discord hands back again, or every row on stop, can be put back as it was.
 */
export class RowBlurrer {
	private readonly originals = new Map<MediaHolder, Originals>();

	/**
	 * @description Puts back what an earlier call blurred on this row, then blurs the enabled parts when the channel is age-restricted.
	 * @param row The row Discord generated.
	 * @param parts Which parts of the row to blur.
	 * @param isNsfw Whether the row's channel is age-restricted.
	 */
	apply(row: ChatRow | undefined, parts: BlurParts, isNsfw: boolean): void {
		for (const holder of mediaHolders(row?.message)) {
			this.restoreHolder(holder);

			if (isNsfw) this.blurHolder(holder, parts);
		}
	}

	/**
	 * @description Puts back every row this blurrer still has blurred.
	 */
	restoreAll(): void {
		for (const holder of [...this.originals.keys()]) this.restoreHolder(holder);
	}

	/**
	 * @description Counts the message objects currently blurred.
	 * @returns How many are being tracked.
	 */
	get size(): number {
		return this.originals.size;
	}

	private blurHolder(holder: MediaHolder, parts: BlurParts): void {
		const saved: Originals = {};

		for (const part of PARTS) {
			if (!parts[part] || !Array.isArray(holder[part])) continue;

			const swap = { original: holder[part], blurred: BLURS[part](holder[part]) };

			saved[part] = swap;
			holder[part] = swap.blurred;
		}

		if (!Object.keys(saved).length) return;

		this.originals.set(holder, saved);
		this.trim();
	}

	private restoreHolder(holder: MediaHolder): void {
		const saved = this.originals.get(holder);

		if (!saved) return;

		for (const part of PARTS) {
			const swap = saved[part];

			if (swap && holder[part] === swap.blurred) holder[part] = swap.original;
		}

		this.originals.delete(holder);
	}

	private trim(): void {
		for (const holder of this.originals.keys()) {
			if (this.originals.size <= MAX_TRACKED) return;

			this.originals.delete(holder);
		}
	}
}
