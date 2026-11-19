#pragma once

#ifdef __cplusplus
#include <cstddef>
#include <deque>
#include <fstream>
#include <mutex>
#include <string>

#include "LoaderLog.h"
#include "LoaderLogEntry.h"

namespace facebook::jsi {
class Runtime;
}

namespace loader {
constexpr const char *kLogDirectoryName   = "Logs";
constexpr const char *kLogFileName        = "unbound.log";
constexpr const char *kNativeLogFileName  = "native.log";
constexpr std::size_t kLogFileMaximumSize = 1024 * 1024;
constexpr std::size_t kLogFilesKept       = 3;
constexpr std::size_t kLogFilesCompressed = 6;
constexpr std::size_t kLogLinesBuffered   = 512;
constexpr std::size_t kPreviousTailBytes  = 16 * 1024;

class RotatingLogFile
{
public:
    // `name` is the file's stem: `unbound` writes `unbound.log`, then `unbound.1.log` and so on.
    RotatingLogFile(std::string name, std::size_t maximumSize, std::size_t filesKept,
                    std::size_t linesBuffered, std::size_t filesCompressed = 0);

    void open(const std::string &directory);
    void append(const std::string &line);
    std::string path(std::size_t generation) const;
    // Older generations past `filesKept`, gzipped: `unbound.3.log.gz` and on.
    std::string compressedPath(std::size_t generation) const;
    // The end of the file as the previous launch left it, read before this launch writes, so a
    // crash report can show what led up to the crash.
    std::string previousTail();

private:
    void rotate();
    void compressOldest();

    std::string name_;
    std::size_t maximumSize_;
    std::size_t filesKept_;
    std::size_t linesBuffered_;
    std::size_t filesCompressed_;
    std::string directory_;
    std::ofstream stream_;
    std::size_t size_ = 0;
    std::deque<std::string> pending_;
    std::string previousTail_;
    std::mutex mutex_;
};

std::string logFileDirectory(const std::string &documents);
// The last `lines` lines the previous launch wrote to `unbound.log`, read when this launch opened
// the log, as plain text.
std::string previousLaunchLogTail(std::size_t lines);
void openLogFile(const std::string &documents);
// Writes the entry to its source's file and hands it to `UnboundNative.logs` subscribers.
void appendLogEntry(LogEntry entry);
// A loader line: source `unbound`, scope `Loader/<category>`.
void appendLogFile(LogLevel level, const std::string &category, const std::string &message);
// Writes console output as `js` lines; Unbound's logger calls `UnboundNative.log` instead.
void installConsoleCapture(facebook::jsi::Runtime &runtime);
}

extern "C" {
#endif

void UnboundAppendLogFile(int level, const char *category, const char *message);
// `source` and `level` are `LogSource` and `LogLevel` indexes; `scope` may be null.
void UnboundAppendNativeLog(int source, int level, const char *scope, const char *message);

#ifdef __cplusplus
}
#endif
