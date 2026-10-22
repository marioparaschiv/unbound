export type ReactionEmoji = {
	id: string | null;
	name: string;
};

export type ReactionRecord = {
	burst_count?: number;
	count?: number;
	count_details?: {
		burst?: number;
		normal?: number;
	};
};

export type ReactionAvatarSelection = {
	count: number;
	types: number[];
};

export type ReactionAvatarFrame = {
	x: number;
	width: number;
};

export type ReactionLayoutItem = {
	extraWidth?: number;
	height: number;
	index: number;
	width: number;
	x: number;
	y: number;
};

export type ReactionLayoutFrame = {
	height: number;
	index: number;
	width: number;
	x: number;
	y: number;
};

export type ReactionLayoutDimensions = {
	contentHeight: number;
	frameHeight: number;
};

export type ReactionLayoutIdentity = {
	messageKey: string;
	itemCount: number;
	ownerCellKey: string;
};

export const REACTION_AVATAR_LIMIT = 5;
export const REACTION_AVATAR_SIZE = 18;
export const REACTION_AVATAR_STEP = 5;

export type Reactor = {
	id: string;
	username?: string;
	avatar?: string | null;
};

export type ReactionAvatarPresentation<T extends Reactor> = {
	overflowCount: number;
	slotCount: number;
	users: T[];
};

export function hydrateReactorsInOrder<T extends Reactor>(
	reactors: T[],
	findUser: (id: string) => T | null | undefined,
): T[] {
	return reactors.map((reactor) => findUser(reactor.id) ?? reactor);
}

export function isCurrentReactionRequest(
	requestKey: string,
	currentKey: string,
	requestGeneration: number,
	currentGeneration: number,
): boolean {
	return requestKey === currentKey && requestGeneration === currentGeneration;
}

export function shouldHandleChannelChange(
	previousChannelId: string | undefined,
	nextChannelId: string | undefined,
): boolean {
	return Boolean(nextChannelId) && previousChannelId !== nextChannelId;
}

export function reactionCellLifecycleAction(
	attached: boolean,
	reused: boolean,
): 'dispose' | 'preserve' | 'render' {
	if (reused) return 'dispose';
	return attached ? 'render' : 'preserve';
}

export function reactionAvatarPresentation<T extends Reactor>(
	users: T[],
	totalCount: number = users.length,
): ReactionAvatarPresentation<T> {
	const count = Math.max(0, Math.floor(totalCount));
	const visibleUserCount = Math.min(users.length, REACTION_AVATAR_LIMIT, count);
	const overflowCount = Math.max(0, count - visibleUserCount);
	const hasOverflow = overflowCount > 0;

	return {
		overflowCount,
		slotCount: visibleUserCount + Number(hasOverflow),
		users,
	};
}

export function reactionAvatarReservedSlotCount(totalCount: number): number {
	const count = Math.max(0, Math.floor(totalCount));
	return Math.min(count, REACTION_AVATAR_LIMIT) + Number(count > REACTION_AVATAR_LIMIT);
}

export function reactionAvatarReservedExtraWidth(
	totalCount: number,
	leadingInset: number,
	trailingPadding: number,
): number {
	const width = reactionAvatarStackWidth(reactionAvatarReservedSlotCount(totalCount));
	return reactionAvatarExtraWidth(width, leadingInset, trailingPadding, totalCount > 0);
}

export function reactionBaseViewWidth(
	layoutWidth: number,
	cellWidth: number,
	viewWidth: number,
): number {
	const inset = Math.max(0, cellWidth - viewWidth);
	return Math.max(0, Math.min(viewWidth, layoutWidth - inset));
}

export function reactionAvatarStackWidth(slotCount: number): number {
	return REACTION_AVATAR_SIZE + Math.max(0, slotCount - 1) * REACTION_AVATAR_STEP;
}

export function reactionAvatarStackPositions(slotCount: number): number[] {
	return Array.from(
		{ length: Math.max(0, Math.floor(slotCount)) },
		(_, index) => index * REACTION_AVATAR_STEP,
	);
}

export function reactionAvatarExtraWidth(
	width: number,
	leadingInset: number,
	trailingPadding: number,
	measured: boolean,
): number {
	if (!measured || !Number.isFinite(width) || width <= 0) return 0;
	return Math.max(0, Math.ceil(width + trailingPadding - leadingInset));
}

export function shouldMeasureReactionAvatarWidth(
	measured: boolean,
	currentWidth: number,
	nextWidth: number,
): boolean {
	return !measured && nextWidth >= currentWidth - 0.5;
}

export function reactionAvatarSummaryProps<T extends Reactor>(
	users: T[],
	guildId?: string,
	max: number = REACTION_AVATAR_LIMIT,
): Record<string, unknown> {
	return {
		guildId,
		max,
		renderIcon: false,
		showDefaultAvatarsForNullUsers: true,
		showUserPopout: true,
		users,
	};
}

export function shouldRenderReactionAvatars(reactionCount: number): boolean {
	return reactionCount > 0;
}

export function reactionCellWidth(baseWidth: number, extraWidth: number): number {
	return baseWidth + Math.max(0, extraWidth);
}

export function reactionLayoutNeedsInvalidation(
	current: ReactionLayoutDimensions,
	target: ReactionLayoutDimensions,
): boolean {
	return (
		Math.abs(current.contentHeight - target.contentHeight) >= 1 ||
		Math.abs(current.frameHeight - target.frameHeight) >= 1
	);
}

export function reactionAncestorHeightDelta(targetHeight: number, baselineHeight: number): number {
	return Math.max(0, targetHeight - baselineHeight);
}

export function reactionCellHeightFloor(contributions: Iterable<number>): number {
	return Math.max(0, ...contributions);
}

export function reactionLayoutIdentityChanged(
	current: ReactionLayoutIdentity,
	target: ReactionLayoutIdentity,
): boolean {
	return (
		current.messageKey !== target.messageKey ||
		current.itemCount !== target.itemCount ||
		current.ownerCellKey !== target.ownerCellKey
	);
}

export function reactionLayoutFrameMatches(
	current: Pick<ReactionLayoutFrame, 'height' | 'width' | 'x' | 'y'> | undefined,
	target: Pick<ReactionLayoutFrame, 'height' | 'width' | 'x' | 'y'>,
): boolean {
	return Boolean(
		current &&
		Math.abs(current.x - target.x) < 0.5 &&
		Math.abs(current.y - target.y) < 0.5 &&
		Math.abs(current.width - target.width) < 0.5 &&
		Math.abs(current.height - target.height) < 0.5,
	);
}

export function reflowReactionItems(
	items: ReactionLayoutItem[],
	containerWidth: number,
): ReactionLayoutFrame[] {
	if (items.length === 0 || containerWidth <= 0) return [];

	const ordered = [...items].sort((first, second) => first.index - second.index);
	const startX = Math.min(...ordered.map((item) => item.x));
	const startY = Math.min(...ordered.map((item) => item.y));
	const horizontalGaps = ordered.flatMap((item, position) => {
		const next = ordered[position + 1];
		if (!next || Math.abs(next.y - item.y) >= 1) return [];
		return [Math.max(0, next.x - item.x - item.width)];
	});
	const horizontalGap = horizontalGaps.length
		? horizontalGaps.reduce((total, gap) => total + gap, 0) / horizontalGaps.length
		: 0;
	const rowTops = [...new Set(ordered.map((item) => item.y))].sort(
		(first, second) => first - second,
	);
	const verticalGaps = rowTops.flatMap((top, index) => {
		const nextTop = rowTops[index + 1];
		if (nextTop === undefined) return [];
		const rowBottom = Math.max(
			...ordered.filter((item) => item.y === top).map((item) => item.y + item.height),
		);
		return [Math.max(0, nextTop - rowBottom)];
	});
	const verticalGap = verticalGaps.length
		? verticalGaps.reduce((total, gap) => total + gap, 0) / verticalGaps.length
		: 0;
	const frames: ReactionLayoutFrame[] = [];
	let x = startX;
	let y = startY;
	let rowHeight = 0;

	for (const item of ordered) {
		const width = reactionCellWidth(item.width, item.extraWidth ?? 0);
		if (x > startX && x + width > startX + containerWidth) {
			x = startX;
			y += rowHeight + verticalGap;
			rowHeight = 0;
		}

		frames.push({ height: item.height, index: item.index, width, x, y });
		x += width + horizontalGap;
		rowHeight = Math.max(rowHeight, item.height);
	}

	return frames;
}

export function reactionAvatarFrame(
	contentFrame: Pick<ReactionLayoutItem, 'width' | 'x'>,
	surfaceWidth: number,
	inset: number = 0,
): ReactionAvatarFrame {
	return {
		x: Math.max(0, contentFrame.x + contentFrame.width - inset),
		width: Math.max(0, surfaceWidth),
	};
}

type CacheEntry<T> = {
	expiresAt: number;
	users: T[];
};

type QueuedRequest<T> = {
	generation: number;
	key: string;
	load: () => Promise<T[]>;
	reject: (error: unknown) => void;
	resolve: (users: T[]) => void;
};

export class ReactionUserCache<T> {
	private entries = new Map<string, CacheEntry<T>>();
	private pending = new Map<string, Promise<T[]>>();
	private queue: QueuedRequest<T>[] = [];
	private activeRequests = 0;
	private generation = 0;

	constructor(
		private readonly maximumEntries: number = 400,
		private readonly maximumConcurrentRequests: number = 3,
		private readonly cacheLifetime: number = 60_000,
		private readonly emptyCacheLifetime: number = 3_000,
	) {}

	get(key: string, now: number = Date.now()): T[] | undefined {
		const entry = this.entries.get(key);
		if (!entry) return undefined;
		if (entry.expiresAt <= now) {
			this.entries.delete(key);
			return undefined;
		}

		this.entries.delete(key);
		this.entries.set(key, entry);
		return entry.users;
	}

	load(key: string, load: () => Promise<T[]>, now: number = Date.now()): Promise<T[]> {
		const cached = this.get(key, now);
		if (cached) return Promise.resolve(cached);

		const pending = this.pending.get(key);
		if (pending) return pending;

		const generation = this.generation;
		const request = new Promise<T[]>((resolve, reject) => {
			this.queue.push({ generation, key, load, reject, resolve });
			this.processQueue();
		}).then((users) => {
			if (generation !== this.generation || this.pending.get(key) !== request) return [];
			this.cache(key, users, Date.now());
			return users;
		});

		this.pending.set(key, request);
		void request.then(
			() => {
				if (this.pending.get(key) === request) this.pending.delete(key);
			},
			() => {
				if (this.pending.get(key) === request) this.pending.delete(key);
			},
		);
		return request;
	}

	invalidate(prefix: string): void {
		this.invalidateMatching((key) => key.startsWith(prefix));
	}

	invalidateMessage(messageId: string, channelId?: string): void {
		const channelPrefix = channelId ? reactionAvatarPrefix(channelId, messageId) : null;
		const encodedMessageId = encodeURIComponent(messageId);
		this.invalidateMatching((key) =>
			channelPrefix ? key.startsWith(channelPrefix) : key.split(':')[1] === encodedMessageId,
		);
	}

	cancelQueuedOutsideChannel(channelId: string | undefined): void {
		const channelPrefix = channelId ? `${encodeURIComponent(channelId)}:` : null;
		const remaining: QueuedRequest<T>[] = [];

		for (const request of this.queue) {
			if (channelPrefix && request.key.startsWith(channelPrefix)) {
				remaining.push(request);
				continue;
			}

			if (this.pending.has(request.key)) this.pending.delete(request.key);
			request.resolve([]);
		}

		this.queue = remaining;
	}

	clear(): void {
		this.generation++;
		this.entries.clear();
		this.pending.clear();
		for (const request of this.queue) request.resolve([]);
		this.queue = [];
	}

	private invalidateMatching(matches: (key: string) => boolean): void {
		for (const key of new Set([...this.entries.keys(), ...this.pending.keys()])) {
			if (!matches(key)) continue;
			this.entries.delete(key);
			this.pending.delete(key);
		}

		const remaining: QueuedRequest<T>[] = [];
		for (const request of this.queue) {
			if (matches(request.key)) request.resolve([]);
			else remaining.push(request);
		}
		this.queue = remaining;
	}

	private cache(key: string, users: T[], now: number): void {
		this.entries.delete(key);
		const lifetime = users.length > 0 ? this.cacheLifetime : this.emptyCacheLifetime;
		this.entries.set(key, { expiresAt: now + lifetime, users });

		while (this.entries.size > this.maximumEntries) {
			const oldest = this.entries.keys().next().value;
			if (typeof oldest !== 'string') return;
			this.entries.delete(oldest);
		}
	}

	private processQueue(): void {
		while (this.activeRequests < this.maximumConcurrentRequests && this.queue.length) {
			const request = this.queue.shift();
			if (!request) return;
			if (request.generation !== this.generation) {
				request.resolve([]);
				continue;
			}

			this.activeRequests++;
			void Promise.resolve()
				.then(request.load)
				.then(request.resolve, request.reject)
				.finally(() => {
					this.activeRequests--;
					this.processQueue();
				});
		}
	}
}

function countValue(value: number | undefined): number {
	return typeof value === 'number' && Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0;
}

export function reactionAvatarSelection(
	reaction: ReactionRecord,
	reactionType?: number,
): ReactionAvatarSelection {
	const burstCount = countValue(reaction.count_details?.burst ?? reaction.burst_count);
	const normalCount = countValue(
		reaction.count_details?.normal ?? Math.max(0, countValue(reaction.count) - burstCount),
	);

	if (reactionType === 0) return { count: normalCount, types: normalCount ? [0] : [] };
	if (reactionType === 1) return { count: burstCount, types: burstCount ? [1] : [] };

	const types = [];
	if (normalCount) types.push(0);
	if (burstCount) types.push(1);

	return { count: normalCount + burstCount, types };
}

export function reactionAvatarKey(
	channelId: string,
	messageId: string,
	emoji: ReactionEmoji,
	types: number[],
): string {
	return [channelId, messageId, emoji.id ?? emoji.name, types.join(',')]
		.map((part) => encodeURIComponent(part))
		.join(':');
}

export function reactionAvatarPrefix(channelId: string, messageId: string): string {
	return `${encodeURIComponent(channelId)}:${encodeURIComponent(messageId)}:`;
}
