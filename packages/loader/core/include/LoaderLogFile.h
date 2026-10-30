#pragma once

#ifdef __cplusplus
#include <cstddef>
#include <deque>
#include <fstream>
#include <mutex>
#include <string>

#include "LoaderLog.h"

namespace facebook::jsi {
class Runtime;
}

namespace loader {
constexpr const char *kLogDirectoryName   = "Logs";
constexpr const char *kLogFileName        = "astral.log";
constexpr std::size_t kLogFileMaximumSize = 1024 * 1024;
constexpr std::size_t kLogFilesKept       = 3;
constexpr std::size_t kLogLinesBuffered   = 512;

class RotatingLogFile
{
public:
    RotatingLogFile(std::size_t maximumSize, std::size_t filesKept, std::size_t linesBuffered);

    void        open(const std::string &directory);
    void        append(const std::string &line);
    std::string path(std::size_t generation) const;

private:
    void rotate();

    std::size_t             maximumSize_;
    std::size_t             filesKept_;
    std::size_t             linesBuffered_;
    std::string             directory_;
    std::ofstream           stream_;
    std::size_t             size_ = 0;
    std::deque<std::string> pending_;
    std::mutex              mutex_;
};

std::string logFileLine(LogLevel level, const std::string &category, const std::string &message,
                        long long epochMilliseconds);
std::string logFileDirectory(const std::string &documents);
void        openLogFile(const std::string &documents);
void        appendLogFile(LogLevel level, const std::string &category, const std::string &message);
void        installConsoleCapture(facebook::jsi::Runtime &runtime);
}

extern "C" {
#endif

void AstralAppendLogFile(int level, const char *category, const char *message);

#ifdef __cplusplus
}
#endif
