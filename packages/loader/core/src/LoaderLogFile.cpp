#include "LoaderLogFile.h"

#include <algorithm>
#include <filesystem>
#include <jsi/jsi.h>
#include <optional>
#include <utility>
#include <vector>

#include "LoaderLogStream.h"
#include "NativePluginRuntime.h"

namespace loader {
namespace jsi = facebook::jsi;

static const char *const kLoaderScope = "Loader";

RotatingLogFile::RotatingLogFile(std::string name, std::size_t maximumSize, std::size_t filesKept,
                                 std::size_t linesBuffered)
    : name_(std::move(name)), maximumSize_(maximumSize), filesKept_(filesKept),
      linesBuffered_(linesBuffered)
{
}

std::string RotatingLogFile::path(std::size_t generation) const
{
    if (generation == 0)
    {
        return directory_ + "/" + name_ + ".log";
    }

    return directory_ + "/" + name_ + "." + std::to_string(generation) + ".log";
}

// A JSON line as plain text; a line that is not one, such as an older loader's, stays as it is.
static std::string readableLine(const std::string &line)
{
    nlohmann::json value = nlohmann::json::parse(line, nullptr, false);
    if (std::optional<LogEntry> entry = logEntryFromJSON(value))
    {
        return formatLogEntry(*entry);
    }

    return line;
}

static std::string lastLines(const std::string &text, std::size_t count)
{
    std::vector<std::string> lines;
    std::size_t begin = 0;
    while (begin < text.size())
    {
        std::size_t end = text.find('\n', begin);
        end             = end == std::string::npos ? text.size() : end;
        if (end > begin)
        {
            lines.push_back(readableLine(text.substr(begin, end - begin)));
        }

        begin = end + 1;
    }

    std::string tail;
    for (std::size_t index = lines.size() > count ? lines.size() - count : 0; index < lines.size();
         index++)
    {
        tail += lines[index] + "\n";
    }

    return tail;
}

std::string RotatingLogFile::previousTail()
{
    std::lock_guard<std::mutex> lock(mutex_);
    return previousTail_;
}

void RotatingLogFile::open(const std::string &directory)
{
    std::lock_guard<std::mutex> lock(mutex_);
    std::error_code error;
    std::filesystem::create_directories(directory, error);
    directory_ = directory;
    {
        std::ifstream previous(path(0), std::ios::binary | std::ios::ate);
        std::streamoff size  = previous ? static_cast<std::streamoff>(previous.tellg()) : 0;
        std::streamoff start = std::max<std::streamoff>(0, size - kPreviousTailBytes);
        std::string tail(static_cast<std::size_t>(std::max<std::streamoff>(0, size - start)), '\0');
        if (previous && !tail.empty())
        {
            previous.seekg(start);
            previous.read(tail.data(), static_cast<std::streamsize>(tail.size()));
        }

        previousTail_ = std::move(tail);
    }

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
    static RotatingLogFile file("unbound", kLogFileMaximumSize, kLogFilesKept, kLogLinesBuffered);
    return file;
}

std::string previousLaunchLogTail(std::size_t lines)
{
    return lastLines(sharedLogFile().previousTail(), lines);
}

static RotatingLogFile &nativeLogFile()
{
    static RotatingLogFile file("native", kLogFileMaximumSize, kLogFilesKept, kLogLinesBuffered);
    return file;
}

std::string logFileDirectory(const std::string &documents)
{
    return documents + "/" + kLogDirectoryName;
}

void openLogFile(const std::string &documents)
{
    sharedLogFile().open(logFileDirectory(documents));
    nativeLogFile().open(logFileDirectory(documents));
}

void appendLogEntry(LogEntry entry)
{
    bool native = entry.source == LogSource::ReactNative || entry.source == LogSource::Native;
    (native ? nativeLogFile() : sharedLogFile()).append(logEntryLine(entry));
    logStream().publish(entry);
}

void appendLogFile(LogLevel level, const std::string &category, const std::string &message)
{
    appendLogEntry({logNow(), LogSource::Unbound, level, {kLoaderScope, category}, message});
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
    jsi::Object global  = runtime.global();
    jsi::Value original = global.getProperty(runtime, "nativeLoggingHook");
    if (global.hasProperty(runtime, "__unboundConsoleCaptured"))
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
                appendLogEntry({logNow(),
                                LogSource::JS,
                                consoleLevel(level),
                                {},
                                arguments[0].getString(rt).utf8(rt)});
            }

            if (forward->isObject() && forward->getObject(rt).isFunction(rt))
            {
                return forward->getObject(rt).asFunction(rt).call(rt, arguments, count);
            }

            return jsi::Value::undefined();
        });
    global.setProperty(runtime, "nativeLoggingHook", std::move(capture));
    global.setProperty(runtime, "__unboundConsoleCaptured", true);
}
}

extern "C" void UnboundAppendLogFile(int level, const char *category, const char *message)
{
    loader::appendLogFile(loader::logLevelFromIndex(level),
                          category ? category : LOG_CATEGORY_DEFAULT, message ? message : "");
}

extern "C" void UnboundAppendNativeLog(int source, int level, const char *scope,
                                       const char *message)
{
    loader::LogSource kind = source == static_cast<int>(loader::LogSource::ReactNative)
                                 ? loader::LogSource::ReactNative
                                 : loader::LogSource::Native;
    std::vector<std::string> parts;
    if (scope && *scope)
    {
        parts.emplace_back(scope);
    }

    loader::appendLogEntry({loader::logNow(), kind, loader::logLevelFromIndex(level),
                            std::move(parts), message ? message : ""});
}
