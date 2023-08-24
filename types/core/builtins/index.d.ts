export interface BuiltIn {
	initialize?: Fn;
	shutdown?: Fn;
	data: {
		id: string;
		async?: boolean;
		default: boolean;
		settings?: string[];
	};
}