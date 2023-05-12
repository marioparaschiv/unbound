export interface ToastOptions {
	title: string;
	content: string;
	duration?: number;
	onTimeout?: Fn;
	icon?: number;
	id?: any;
}

export interface InternalToastOptions extends ToastOptions {
	closing?: boolean;
	date?: number;
}