#include "LoaderNativeLogLines.h"

#include <cctype>
#include <utility>

namespace loader {
namespace {
    constexpr std::string_view kReactSubsystem   = "com.facebook.react";
    constexpr std::string_view kLoaderSubsystem  = "app.unbound";
    constexpr std::string_view kJavaScriptThread = "com.facebook.react.JavaScript";
    constexpr std::string_view kReplacement      = "\xEF\xBF\xBD";

    bool isDigit(char character)
    {
        return character >= '0' && character <= '9';
    }

    std::size_t skipDigits(std::string_view text, std::size_t from)
    {
        while (from < text.size() && isDigit(text[from]))
        {
            from++;
        }

        return from;
    }

    // The length of the valid UTF-8 sequence at `index`, or 0 when it is invalid or cut short.
    std::size_t utf8SequenceLength(std::string_view bytes, std::size_t index)
    {
        auto at = [&](std::size_t offset) -> unsigned {
            return index + offset < bytes.size() ? static_cast<unsigned char>(bytes[index + offset])
                                                 : 0;
        };
        unsigned lead = at(0);
        std::size_t length;
        unsigned low  = 0x80;
        unsigned high = 0xBF;
        if (lead < 0x80)
        {
            return 1;
        }

        if (lead >= 0xC2 && lead <= 0xDF)
        {
            length = 2;
        }
        else if (lead >= 0xE0 && lead <= 0xEF)
        {
            length = 3;
            low    = lead == 0xE0 ? 0xA0 : low;
            high   = lead == 0xED ? 0x9F : high;
        }
        else if (lead >= 0xF0 && lead <= 0xF4)
        {
            length = 4;
            low    = lead == 0xF0 ? 0x90 : low;
            high   = lead == 0xF4 ? 0x8F : high;
        }
        else
        {
            return 0;
        }

        if (at(1) < low || at(1) > high)
        {
            return 0;
        }

        for (std::size_t offset = 2; offset < length; offset++)
        {
            if (at(offset) < 0x80 || at(offset) > 0xBF)
            {
                return 0;
            }
        }

        return length;
    }

    // `yyyy-MM-dd HH:mm:ss`, an optional fraction and UTC offset, and the space after: its length
    // or 0.
    std::size_t timestampLength(std::string_view line)
    {
        constexpr std::string_view shape = "0000-00-00 00:00:00";
        if (line.size() < shape.size())
        {
            return 0;
        }

        for (std::size_t index = 0; index < shape.size(); index++)
        {
            if (shape[index] == '0' ? !isDigit(line[index]) : line[index] != shape[index])
            {
                return 0;
            }
        }

        std::size_t end = shape.size();
        if (end < line.size() && line[end] == '.')
        {
            end = skipDigits(line, end + 1);
        }

        if (end < line.size() && (line[end] == '+' || line[end] == '-')
            && skipDigits(line, end + 1) == end + 5)
        {
            end += 5;
        }

        return end < line.size() && line[end] == ' ' ? end + 1 : 0;
    }

    // NSLog's `Discord[123:4567] ` after its timestamp: its length or 0.
    std::size_t processTagLength(std::string_view text)
    {
        std::size_t open = text.find('[');
        if (open == 0 || open == std::string_view::npos
            || text.substr(0, open).find(' ') != std::string_view::npos)
        {
            return 0;
        }

        std::size_t pid = skipDigits(text, open + 1);
        if (pid == open + 1 || pid >= text.size() || text[pid] != ':')
        {
            return 0;
        }

        std::size_t close = text.find(']', pid);
        if (close == std::string_view::npos || close == pid + 1)
        {
            return 0;
        }

        for (std::size_t index = pid + 1; index < close; index++)
        {
            if (!std::isalnum(static_cast<unsigned char>(text[index])))
            {
                return 0;
            }
        }

        std::size_t end = close + 1;
        return end < text.size() && text[end] == ' ' ? end + 1 : end;
    }

    // The bracketed tag starting `text`, without its brackets.
    std::optional<std::string_view> leadingTag(std::string_view text)
    {
        std::size_t close = text.find(']');
        if (text.empty() || text.front() != '[' || close == std::string_view::npos)
        {
            return std::nullopt;
        }

        return text.substr(1, close - 1);
    }

    std::string_view afterTag(std::string_view text, std::string_view tag)
    {
        text.remove_prefix(tag.size() + 2);
        if (!text.empty() && text.front() == ' ')
        {
            text.remove_prefix(1);
        }

        return text;
    }

    // RCTLog's level names (`RCTLogLevels` in RCTLog.mm).
    std::optional<LogLevel> reactLevel(std::string_view name)
    {
        if (name == "trace")
        {
            return LogLevel::Debug;
        }

        if (name == "info")
        {
            return LogLevel::Info;
        }

        if (name == "warn")
        {
            return LogLevel::Warning;
        }

        if (name == "error" || name == "fatal")
        {
            return LogLevel::Error;
        }

        return std::nullopt;
    }

    std::optional<NativeLogLine> logLine(LogSource source, LogLevel level, std::string_view scope,
                                         std::string_view message)
    {
        if (message.empty())
        {
            return std::nullopt;
        }

        return NativeLogLine{source, level, std::string(scope), std::string(message)};
    }

    bool isReactFormatted(std::string_view text)
    {
        std::optional<std::string_view> tag = leadingTag(text);
        return tag && (reactLevel(*tag) || tag->starts_with("tid:"));
    }

    // RCTFormatLog's `[<level>][tid:<thread>][<file>:<line>] message`, after its timestamp.
    std::optional<NativeLogLine> reactFormattedLine(std::string_view text)
    {
        LogLevel level = LogLevel::Info;
        std::string_view thread;
        std::string_view file;
        std::optional<std::string_view> tag = leadingTag(text);
        if (tag && reactLevel(*tag))
        {
            level = *reactLevel(*tag);
            text.remove_prefix(tag->size() + 2);
            tag = leadingTag(text);
        }

        if (tag && tag->starts_with("tid:"))
        {
            thread = tag->substr(4);
            text.remove_prefix(tag->size() + 2);
            tag = leadingTag(text);
        }

        // The file tag follows the thread directly; the message starts after a space.
        if (tag)
        {
            file = *tag;
            text.remove_prefix(tag->size() + 2);
        }

        if (!text.empty() && text.front() == ' ')
        {
            text.remove_prefix(1);
        }

        // `console.*` reaches RCTLog from the JS thread without a file; it is captured as `js`
        // already.
        if (file.empty() && thread == kJavaScriptThread)
        {
            return std::nullopt;
        }

        return logLine(LogSource::ReactNative, level, file, text);
    }

    // A line after NSLog's prefix, sorted by the os_log `[subsystem:category]` tag it may start
    // with.
    std::optional<NativeLogLine> taggedLine(std::string_view text)
    {
        std::optional<std::string_view> tag = leadingTag(text);
        if (!tag)
        {
            return logLine(LogSource::Native, LogLevel::Info, {}, text);
        }

        std::size_t colon          = tag->rfind(':');
        std::string_view subsystem = colon == std::string_view::npos ? "" : tag->substr(0, colon);
        std::string_view category = colon == std::string_view::npos ? *tag : tag->substr(colon + 1);
        if (category == "javascript" || subsystem.starts_with(kLoaderSubsystem)
            || (subsystem.empty() && isLogCategory(std::string(category))))
        {
            return std::nullopt;
        }

        if (subsystem.starts_with(kReactSubsystem) || (subsystem.empty() && category == "native"))
        {
            return logLine(LogSource::ReactNative, LogLevel::Info, {}, afterTag(text, *tag));
        }

        if (tag->starts_with("RCT") || tag->starts_with("React"))
        {
            return logLine(LogSource::ReactNative, LogLevel::Info, {}, text);
        }

        return logLine(LogSource::Native, LogLevel::Info, {}, text);
    }
}

NativeLogLineSplitter::NativeLogLineSplitter(std::size_t maximum) : maximum_(maximum) {}

void NativeLogLineSplitter::feed(std::string_view bytes, const Emit &emit)
{
    while (!bytes.empty())
    {
        std::size_t newline = bytes.find('\n');
        pending_.append(bytes.substr(0, newline));
        while (pending_.size() > maximum_)
        {
            // Back off to a character boundary so a cut never splits a UTF-8 sequence.
            std::size_t cut   = maximum_;
            std::size_t floor = maximum_ > 3 ? maximum_ - 3 : 0;
            while (cut > floor && (static_cast<unsigned char>(pending_[cut]) & 0xC0) == 0x80)
            {
                cut--;
            }

            cut = cut == 0 ? maximum_ : cut;
            emit(validUtf8(std::string_view(pending_).substr(0, cut)));
            pending_.erase(0, cut);
        }

        if (newline == std::string_view::npos)
        {
            return;
        }

        flush(emit);
        bytes.remove_prefix(newline + 1);
    }
}

void NativeLogLineSplitter::flush(const Emit &emit)
{
    std::string_view line = pending_;
    if (!line.empty() && line.back() == '\r')
    {
        line.remove_suffix(1);
    }

    emit(validUtf8(line));
    pending_.clear();
}

bool NativeLogLineSplitter::hasPending() const
{
    return !pending_.empty();
}

std::string validUtf8(std::string_view bytes)
{
    std::string valid;
    valid.reserve(bytes.size());
    std::size_t index = 0;
    while (index < bytes.size())
    {
        std::size_t length = utf8SequenceLength(bytes, index);
        valid.append(length ? bytes.substr(index, length) : kReplacement);
        index += length ? length : 1;
    }

    return valid;
}

std::optional<NativeLogLine> classifyNativeLogLine(std::string_view line)
{
    while (!line.empty() && std::isspace(static_cast<unsigned char>(line.back())))
    {
        line.remove_suffix(1);
    }

    if (std::size_t stamp = timestampLength(line))
    {
        std::string_view rest = line.substr(stamp);
        if (isReactFormatted(rest))
        {
            return reactFormattedLine(rest);
        }

        if (std::size_t process = processTagLength(rest))
        {
            return taggedLine(rest.substr(process));
        }
    }

    return taggedLine(line);
}
}
