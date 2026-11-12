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

export type OverlayButtonProps = {
	icon?: number;
	onPress?: () => void;
	accessibilityLabel?: string;
	accessibilityState?: { selected?: boolean };
};

export type Phase = 'starting' | 'active' | 'stopping';

export type Session<Target> = {
	target: Target;
	phase: Phase;
};

export type EnterResult = 'pending' | 'active' | 'failed';

export type PipWindow = {
	enter(aspect: readonly [number, number], source: MediaSource | undefined): Promise<EnterResult>;
	exit(): 'pending' | 'ended';
	dispose(): void;
};

export type WindowEvents = {
	onEnded(): void;
};

export type CreateWindow = (context: PluginContext, events: WindowEvents) => PipWindow;
