//! Release builds on Windows are GUI-subsystem apps, so opening DevTools shows no console window.
//! Such a process starts with no console, so a subcommand run from a terminal (`--help`,
//! `serve-bridge`) attaches to the terminal's console to print there.

/// Attaches to the launching terminal's console when the process has no output handle; a pipe
/// (an agent running `mcp`) or an existing console is left as it is.
#[cfg(windows)]
pub fn attach() {
	const STD_OUTPUT_HANDLE: u32 = -11i32 as u32;
	const ATTACH_PARENT_PROCESS: u32 = u32::MAX;
	unsafe extern "system" {
		fn GetStdHandle(handle: u32) -> *mut core::ffi::c_void;
		fn AttachConsole(process: u32) -> i32;
	}
	// SAFETY: both are plain Win32 calls with constant arguments and no pointers passed in.
	unsafe {
		if GetStdHandle(STD_OUTPUT_HANDLE).is_null() {
			// Fails when launched from Explorer, which has no console; there is nothing to attach.
			AttachConsole(ATTACH_PARENT_PROCESS);
		}
	}
}

#[cfg(not(windows))]
pub fn attach() {}
