#include "LoaderLogFile.h"

#include <chrono>
#include <cstdio>
#include <ctime>
#include <filesystem>
#include <jsi/jsi.h>

#include "NativePluginRuntime.h"

namespace loader {
namespace jsi = facebook::jsi;

static const char *const kConsoleCategory = "console";

RotatingLogFile::RotatingLogFile(std::size_t maximumSize, std::size_t filesKept,
                                 std::size_t linesBuffered)
    : maximumSize_(maximumSize), filesKept_(filesKept), linesBuffered_(linesBuffered)
{
}

std::string RotatingLogFile::path(std::size_t generation) const
{
    if (generation == 0)
    {
        return directory_ + "/" + kLogFileName;
    }
    return directory_ + "/astral." + std::to_string(generation) + ".log";
}

void RotatingLogFile::open(const std::string &directory)
{
    std::lock_guard<std::mutex> lock(mutex_);
    std::error_code             error;
    std::filesystem::create_directories(directory, error);
    directory_ = directory;
    stream_.open(path(0), std::ios::app | std::ios::binary);
    size_ = static_cast<std::size_t>(std::filesystem::file_size(path(0), error));
    if (error)
    {
        size_ = 0;
    }
    std::deque<std::string> pending;
    pending.swap(pending_);
    for (const std::string &line : pending)
    {
        if (size_ + line.size() > maximumSize_)
        {
            rotate();
        }
        stream_ << line;
        size_ += line.size();
    }
    stream_.flush();
}

void RotatingLogFile::append(const std::string &line)
{
    std::lock_guard<std::mutex> lock(mutex_);
    if (!stream_.is_open())
    {
        if (directory_.empty())
        {
            pending_.push_back(line);
            if (pending_.size() > linesBuffered_)
            {
                pending_.pop_front();
            }
        }
        return;
    }
    if (size_ > 0 && size_ + line.size() > maximumSize_)
    {
        rotate();
    }
    stream_ << line;
    stream_.flush();
    size_ += line.size();
}

void RotatingLogFile::rotate()
{
    stream_.close();
    std::error_code error;
    std::filesystem::remove(path(filesKept_ - 1), error);
    for (std::size_t generation = filesKept_ - 1; generation > 0; generation--)
    {
        std::filesystem::rename(path(generation - 1), path(generation), error);
    }
    stream_.open(path(0), std::ios::trunc | std::ios::binary);
    size_ = 0;
}

static RotatingLogFile &sharedLogFile()
{
    static RotatingLogFile file(kLogFileMaximumSize, kLogFilesKept, kLogLinesBuffered);
    return file;
}

static char levelLetter(LogLevel level)
{
    switch (level)
    {
        case LogLevel::Debug:
            return 'D';
        case LogLevel::Warning:
            return 'W';
        case LogLevel::Error:
            return 'E';
        default:
            return 'I';
    }
}

std::string logFileLine(LogLevel level, const std::string &category, const std::string &message,
                        long long epochMilliseconds)
{
    std::time_t seconds = static_cast<std::time_t>(epochMilliseconds / 1000);
    std::tm     time{};
    gmtime_r(&seconds, &time);
    char stamp[32];
    std::snprintf(stamp, sizeof(stamp), "%04d-%02d-%02dT%02d:%02d:%02d.%03lldZ",
                  time.tm_year + 1900, time.tm_mon + 1, time.tm_mday, time.tm_hour, time.tm_min,
                  time.tm_sec, epochMilliseconds % 1000);
    return std::string(stamp) + " " + levelLetter(level) + " [" + category + "] " + message + "\n";
}

std::string logFileDirectory(const std::string &documents)
{
    return documents + "/" + kLogDirectoryName;
}

void openLogFile(const std::string &documents)
{
    sharedLogFile().open(logFileDirectory(documents));
}

void appendLogFile(LogLevel level, const std::string &category, const std::string &message)
{
    long long now = std::chrono::duration_cast<std::chrono::milliseconds>(
                        std::chrono::system_clock::now().time_since_epoch())
                        .count();
    sharedLogFile().append(logFileLine(level, category, message, now));
}

static LogLevel consoleLevel(double level)
{
    if (level >= 3)
    {
        return LogLevel::Error;
    }
    if (level >= 2)
    {
        return LogLevel::Warning;
    }
    if (level >= 1)
    {
        return LogLevel::Info;
    }
    return LogLevel::Debug;
}

void installConsoleCapture(jsi::Runtime &runtime)
{
    jsi::Object global   = runtime.global();
    jsi::Value  original = global.getProperty(runtime, "nativeLoggingHook");
    if (global.hasProperty(runtime, "__astralConsoleCaptured"))
    {
        return;
    }
    auto forward = std::make_shared<jsi::Value>(runtime, original);
    auto capture = native::makeFunction(
        runtime, "nativeLoggingHook", 2,
        [forward](jsi::Runtime &rt, const jsi::Value &, const jsi::Value *arguments,
                  size_t count) -> jsi::Value {
            if (count > 0 && arguments[0].isString())
            {
                double level = count > 1 && arguments[1].isNumber() ? arguments[1].getNumber() : 1;
                appendLogFile(consoleLevel(level), kConsoleCategory,
                              arguments[0].getString(rt).utf8(rt));
            }
            if (forward->isObject() && forward->getObject(rt).isFunction(rt))
            {
                return forward->getObject(rt).asFunction(rt).call(rt, arguments, count);
            }
            return jsi::Value::undefined();
        });
    global.setProperty(runtime, "nativeLoggingHook", std::move(capture));
    global.setProperty(runtime, "__astralConsoleCaptured", true);
}
}

extern "C" void AstralAppendLogFile(int level, const char *category, const char *message)
{
    loader::appendLogFile(loader::logLevelFromIndex(level),
                          category ? category : LOG_CATEGORY_DEFAULT, message ? message : "");
}
