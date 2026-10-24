import type { Reactor } from '~/avatars';

export type SurfaceState = {
	guildId?: string;
	height: number;
	measured: boolean;
	onWidth: (width: number) => void;
	totalCount: number;
	users: Reactor[];
	width: number;
};

/** What each mounted avatar surface renders, by surface id; Fabric only passes surfaces serializable props. */
export const surfaceStates = new Map<string, SurfaceState>();
