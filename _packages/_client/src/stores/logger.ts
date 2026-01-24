import type { LoggerStoreState } from '@unbound-app/types/stores';
import { create } from 'zustand';


const LoggerStore = create<LoggerStoreState>((set) => ({
	logs: [],
	addLog(message, level) {
		set(prev => ({
			logs: [
				...prev.logs.slice(-50),
				{
					time: Date.now(),
					level,
					message
				}
			]
		}));
	},
}));

export default LoggerStore;