#pragma once

#include <cstddef>
#include <functional>
#include <optional>
#include <string>
#include <string_view>

#include "LoaderLogEntry.h"

namespace loader {
// A longer stderr/stdout line is cut into pieces of at most this many bytes.
constexpr std::size_t kNativeLogLineMaximum = 16 * 1024;

// One captured stderr/stdout line, sorted into `react-native` or `native`.
struct NativeLogLine {
    LogSource source = LogSource::Native;
    LogLevel  level  = LogLevel::Info;
    // React Native's `<file>:<line>` tag when the line has one, otherwise empty.
    std::string scope;
    std::string message;
};

// Splits a byte stream into lines without their line ending, with invalid UTF-8 replaced.
class NativeLogLineSplitter
{
public:
    using Emit = std::function<void(std::string line)>;

    explicit NativeLogLineSplitter(std::size_t maximum = kNativeLogLineMaximum);

    void feed(std::string_view bytes, const Emit &emit);
    // Emits a partial line still waiting for its newline.
    void flush(const Emit &emit);
    bool hasPending() const;

private:
    std::string pending_;
    std::size_t maximum_;
};

// `bytes` with every invalid UTF-8 sequence replaced by U+FFFD.
std::string validUtf8(std::string_view bytes);
// Sorts a captured line, without NSLog's timestamp and process prefix. Empty for lines already
// captured elsewhere: JS console echoes and the loader's own os_log lines.
std::optional<NativeLogLine> classifyNativeLogLine(std::string_view line);
}
