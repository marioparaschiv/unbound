#pragma once

// Copies stderr and stdout into `native.log` while still writing them where they went before. Runs
// once per process; call it after the log file opens.
void UnboundStartNativeLogCapture();
