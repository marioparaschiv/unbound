export type UnboundLifecycle = {
	initialize(): void;
	shutdown(): void;
};

export type UnboundGlobal = {
	widgets: typeof import('./widgets');
} & UnboundLifecycle;
