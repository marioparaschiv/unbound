#include "LoaderTombstone.h"

#include <cstdint>
#include <cstdio>
#include <map>
#include <vector>

namespace loader {
namespace {
    constexpr size_t kMaxFrames = 64;

    constexpr uint32_t kTombstoneTid          = 6;
    constexpr uint32_t kTombstoneSignal       = 10;
    constexpr uint32_t kTombstoneAbortMessage = 14;
    constexpr uint32_t kTombstoneThreads      = 16;
    constexpr uint32_t kSignalNumber          = 1;
    constexpr uint32_t kSignalName            = 2;
    constexpr uint32_t kMapKey                = 1;
    constexpr uint32_t kMapValue              = 2;
    constexpr uint32_t kThreadId              = 1;
    constexpr uint32_t kThreadName            = 2;
    constexpr uint32_t kThreadBacktrace       = 4;
    constexpr uint32_t kFrameRelativePC       = 1;
    constexpr uint32_t kFramePC               = 2;
    constexpr uint32_t kFrameFunctionName     = 4;
    constexpr uint32_t kFrameFunctionOffset   = 5;
    constexpr uint32_t kFrameFileName         = 6;
    constexpr uint8_t  kWireVarint            = 0;
    constexpr uint8_t  kWireFixed64           = 1;
    constexpr uint8_t  kWireLengthDelimited   = 2;
    constexpr uint8_t  kWireFixed32           = 5;

    struct Field {
        uint32_t    number = 0;
        uint8_t     wire   = 0;
        uint64_t    value  = 0;
        std::string bytes;
    };

    class Reader
    {
    public:
        explicit Reader(const std::string &data) : data_(data) {}

        bool next(Field &field)
        {
            if (failed_ || position_ >= data_.size())
            {
                return false;
            }
            uint64_t key = 0;
            if (!varint(key))
            {
                return fail();
            }
            field.number = static_cast<uint32_t>(key >> 3);
            field.wire   = static_cast<uint8_t>(key & 7);
            field.value  = 0;
            field.bytes.clear();
            switch (field.wire)
            {
                case kWireVarint:
                    return varint(field.value) || fail();
                case kWireFixed64:
                    return skip(8) || fail();
                case kWireFixed32:
                    return skip(4) || fail();
                case kWireLengthDelimited: {
                    uint64_t length = 0;
                    if (!varint(length) || length > data_.size() - position_)
                    {
                        return fail();
                    }
                    field.bytes = data_.substr(position_, static_cast<size_t>(length));
                    position_ += static_cast<size_t>(length);
                    return true;
                }
                default:
                    return fail();
            }
        }

    private:
        bool varint(uint64_t &value)
        {
            value = 0;
            for (int shift = 0; shift < 64 && position_ < data_.size(); shift += 7)
            {
                uint8_t byte = static_cast<uint8_t>(data_[position_++]);
                value |= static_cast<uint64_t>(byte & 0x7f) << shift;
                if (!(byte & 0x80))
                {
                    return true;
                }
            }
            return false;
        }

        bool skip(size_t count)
        {
            if (count > data_.size() - position_)
            {
                return false;
            }
            position_ += count;
            return true;
        }

        bool fail()
        {
            failed_ = true;
            return false;
        }

        const std::string &data_;
        size_t             position_ = 0;
        bool               failed_   = false;
    };

    struct Frame {
        uint64_t    relativePC = 0;
        uint64_t    pc         = 0;
        uint64_t    offset     = 0;
        std::string function;
        std::string file;
    };

    struct Thread {
        uint32_t           id = 0;
        std::string        name;
        std::vector<Frame> frames;
    };

    Frame parseFrame(const std::string &bytes)
    {
        Frame  frame;
        Reader reader(bytes);
        Field  field;
        while (reader.next(field))
        {
            switch (field.number)
            {
                case kFrameRelativePC:
                    frame.relativePC = field.value;
                    break;
                case kFramePC:
                    frame.pc = field.value;
                    break;
                case kFrameFunctionName:
                    frame.function = field.bytes;
                    break;
                case kFrameFunctionOffset:
                    frame.offset = field.value;
                    break;
                case kFrameFileName:
                    frame.file = field.bytes;
                    break;
                default:
                    break;
            }
        }
        return frame;
    }

    Thread parseThread(const std::string &bytes)
    {
        Thread thread;
        Reader reader(bytes);
        Field  field;
        while (reader.next(field))
        {
            if (field.number == kThreadId && field.wire == kWireVarint)
            {
                thread.id = static_cast<uint32_t>(field.value);
            }
            else if (field.number == kThreadName && field.wire == kWireLengthDelimited)
            {
                thread.name = field.bytes;
            }
            else if (field.number == kThreadBacktrace && field.wire == kWireLengthDelimited &&
                     thread.frames.size() < kMaxFrames)
            {
                thread.frames.push_back(parseFrame(field.bytes));
            }
        }
        return thread;
    }

    std::string hex(uint64_t value)
    {
        char buffer[24];
        std::snprintf(buffer, sizeof(buffer), "0x%llx", static_cast<unsigned long long>(value));
        return buffer;
    }
}

std::optional<std::string> tombstoneStack(const std::string &tombstone)
{
    uint32_t                   tid    = 0;
    int64_t                    signal = -1;
    std::string                signalName;
    std::string                abortMessage;
    std::map<uint32_t, Thread> threads;

    Reader reader(tombstone);
    Field  field;
    while (reader.next(field))
    {
        if (field.number == kTombstoneTid && field.wire == kWireVarint)
        {
            tid = static_cast<uint32_t>(field.value);
        }
        else if (field.number == kTombstoneSignal && field.wire == kWireLengthDelimited)
        {
            Reader signalReader(field.bytes);
            Field  signalField;
            while (signalReader.next(signalField))
            {
                if (signalField.number == kSignalNumber && signalField.wire == kWireVarint)
                {
                    signal = static_cast<int32_t>(signalField.value);
                }
                else if (signalField.number == kSignalName &&
                         signalField.wire == kWireLengthDelimited)
                {
                    signalName = signalField.bytes;
                }
            }
        }
        else if (field.number == kTombstoneAbortMessage && field.wire == kWireLengthDelimited)
        {
            abortMessage = field.bytes;
        }
        else if (field.number == kTombstoneThreads && field.wire == kWireLengthDelimited)
        {
            Reader   entry(field.bytes);
            Field    entryField;
            uint32_t key = 0;
            Thread   thread;
            bool     hasThread = false;
            while (entry.next(entryField))
            {
                if (entryField.number == kMapKey && entryField.wire == kWireVarint)
                {
                    key = static_cast<uint32_t>(entryField.value);
                }
                else if (entryField.number == kMapValue && entryField.wire == kWireLengthDelimited)
                {
                    thread    = parseThread(entryField.bytes);
                    hasThread = true;
                }
            }
            if (hasThread)
            {
                threads[key ? key : thread.id] = std::move(thread);
            }
        }
    }

    auto crashing = threads.find(tid);
    if (crashing == threads.end() || crashing->second.frames.empty())
    {
        return std::nullopt;
    }

    std::string text = "Signal " + (signal >= 0 ? std::to_string(signal) : std::string("?"));
    if (!signalName.empty())
    {
        text += " (" + signalName + ")";
    }
    text += " in thread " + std::to_string(tid);
    if (!crashing->second.name.empty())
    {
        text += " (" + crashing->second.name + ")";
    }
    text += ", from Android's tombstone\n";
    if (!abortMessage.empty())
    {
        text += "Abort message: " + abortMessage + "\n";
    }
    size_t index = 0;
    for (const Frame &frame : crashing->second.frames)
    {
        text += "#" + std::to_string(index++) + " " + hex(frame.pc) + " " +
                (frame.file.empty() ? "?" : frame.file) + " + " + hex(frame.relativePC);
        if (!frame.function.empty())
        {
            text += " " + frame.function + "+" + std::to_string(frame.offset);
        }
        text += "\n";
    }
    return text;
}

static std::string trimmed(const std::string &line)
{
    size_t start = line.find_first_not_of(" \t\r");
    size_t end   = line.find_last_not_of(" \t\r");
    return start == std::string::npos ? "" : line.substr(start, end - start + 1);
}

std::optional<std::string> anrTraceStack(const std::string &trace)
{
    constexpr size_t kMaxFrames = 60;
    std::string      text;
    size_t           frames = 0;
    bool             inMain = false;
    size_t           start  = 0;
    while (start <= trace.size())
    {
        size_t      end = trace.find('\n', start);
        std::string line =
            trace.substr(start, end == std::string::npos ? std::string::npos : end - start);
        start            = end == std::string::npos ? trace.size() + 1 : end + 1;
        std::string body = trimmed(line);
        if (!inMain)
        {
            inMain = body.starts_with("\"main\" ");
            continue;
        }
        if (body.empty())
        {
            break;
        }
        bool frame = body.starts_with("at ") || body.starts_with("native: #") ||
                     body.starts_with("- waiting") || body.starts_with("- locked") ||
                     body.starts_with("- blocked");
        if (frame && frames < kMaxFrames)
        {
            text += body + "\n";
            frames++;
        }
    }
    if (frames == 0)
    {
        return std::nullopt;
    }
    return "ANR in thread 1 (main), from Android's ANR trace\n" + text;
}
}
