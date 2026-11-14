#pragma once

namespace unbound::android {
// Streams this process's logcat into `native.log` from a background thread. Runs once per process;
// call after the log file opens.
void startLogcatCapture();
}
