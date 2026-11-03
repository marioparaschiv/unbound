import type { PluginContext } from '@unbound-app/api/native';

export type MediaSource = {
	uri?: unknown;
	sourceURI?: unknown;
	videoURI?: unknown;
	embedURI?: unknown;
	isGIFV?: unknown;
	width?: unknown;
	height?: unknown;
};

export type Phase = 'starting' | 'active' | 'stopping';

export type Session<Target> = {
	target: Target;
	phase: Phase;
	restore: boolean;
};

export type PlayerInfo = {
	key: string | undefined;
	paused: boolean;
};

export type EnterResult = 'pending' | 'active' | 'failed';

export type PipWindow = {
	enter(aspect: readonly [number, number]): Promise<EnterResult>;
	exit(): 'pending' | 'ended';
	dispose(): void;
};

export type WindowEvents = {
	onEnded(inBackground: boolean): void;
};

export type CreateWindow = (context: PluginContext, events: WindowEvents) => PipWindow;

export type SessionProps = (
	session: Session<unknown> | null,
	loop: boolean,
) => Record<string, unknown> | null;

export type VideoInstance = {
	props?: { source?: { uri?: unknown } | number; paused?: unknown };
	_root?: unknown;
	forceUpdate?: () => void;
};
