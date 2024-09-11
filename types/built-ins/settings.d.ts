import type { ComponentType } from 'react';

export interface CustomScreenProps {
	title: string;
	render: ComponentType;
}