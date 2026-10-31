import type { NativeJavaBridge } from '@unbound-app/api/native';

// Deliberately misplaced: a Java call inside ios/.
export function paint(java: NativeJavaBridge) {
	java.getClass('x');
}
