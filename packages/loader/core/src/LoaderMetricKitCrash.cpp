#include "LoaderMetricKitCrash.h"

#include <cinttypes>
#include <cstdio>

namespace loader {
namespace {
    constexpr size_t kMaxFrames = 60;

    MetricKitImageCheck &imageCheck()
    {
        static MetricKitImageCheck check;
        return check;
    }

    std::string hex(uint64_t value)
    {
        char buffer[24];
        std::snprintf(buffer, sizeof(buffer), "0x%" PRIx64, value);
        return buffer;
    }

    uint64_t unsignedMember(const nlohmann::json &object, const char *key)
    {
        auto found = object.find(key);
        return found != object.end() && found->is_number_unsigned() ? found->get<uint64_t>()
               : found != object.end() && found->is_number_integer()
                   ? static_cast<uint64_t>(found->get<int64_t>())
                   : 0;
    }

    std::string textMember(const nlohmann::json &object, const char *key)
    {
        auto found = object.find(key);
        if (found == object.end())
        {
            return {};
        }

        return found->is_string() ? found->get<std::string>() : found->dump();
    }

    const nlohmann::json *crashingThread(const nlohmann::json &crash)
    {
        auto tree = crash.find("callStackTree");
        if (tree == crash.end() || !tree->is_object())
        {
            return nullptr;
        }

        auto stacks = tree->find("callStacks");
        if (stacks == tree->end() || !stacks->is_array() || stacks->empty())
        {
            return nullptr;
        }

        for (const nlohmann::json &stack : *stacks)
        {
            if (stack.value("threadAttributed", false))
            {
                return &stack;
            }
        }

        return &stacks->front();
    }

    std::string frameLine(size_t index, const nlohmann::json &frame)
    {
        std::string line =
            "#" + std::to_string(index) + " " + hex(unsignedMember(frame, "address"));
        std::string binary = textMember(frame, "binaryName");
        if (!binary.empty())
        {
            line +=
                " " + binary + " + " + hex(unsignedMember(frame, "offsetIntoBinaryTextSegment"));
        }

        return line + "\n";
    }
}

void setMetricKitImageCheck(MetricKitImageCheck check)
{
    imageCheck() = std::move(check);
}

static bool fromThisApp(const nlohmann::json &frame)
{
    std::string binary = textMember(frame, "binaryName");
    return binary.empty() || !imageCheck() || imageCheck()(binary);
}

static std::optional<std::string> attributedFrames(const nlohmann::json &diagnostic)
{
    const nlohmann::json *thread = diagnostic.is_object() ? crashingThread(diagnostic) : nullptr;
    if (!thread)
    {
        return std::nullopt;
    }

    auto roots = thread->find("callStackRootFrames");
    if (roots == thread->end() || !roots->is_array() || roots->empty())
    {
        return std::nullopt;
    }

    std::string text;
    const nlohmann::json *frame = &roots->front();
    for (size_t index = 0; frame && frame->is_object() && index < kMaxFrames; index++)
    {
        if (!fromThisApp(*frame))
        {
            return std::nullopt;
        }

        text += frameLine(index, *frame);
        auto children = frame->find("subFrames");
        frame         = children != frame->end() && children->is_array() && !children->empty()
                            ? &children->front()
                            : nullptr;
    }

    return text;
}

std::optional<std::string> metricKitCrashStack(const nlohmann::json &crash)
{
    std::optional<std::string> frames = attributedFrames(crash);
    if (!frames)
    {
        return std::nullopt;
    }

    nlohmann::json metadata = crash.value("diagnosticMetaData", nlohmann::json::object());
    std::string text        = "Signal " + textMember(metadata, "signal") + "\n";
    std::string exception   = textMember(metadata, "exceptionType");
    if (!exception.empty())
    {
        text += "Exception " + exception + " code " + textMember(metadata, "exceptionCode") + "\n";
    }

    std::string reason = textMember(metadata, "terminationReason");
    if (!reason.empty())
    {
        text += "Termination " + reason + "\n";
    }

    return text + *frames;
}

std::optional<std::string> metricKitDiskWriteStack(const nlohmann::json &diskWrite)
{
    std::optional<std::string> frames = attributedFrames(diskWrite);
    if (!frames)
    {
        return std::nullopt;
    }

    nlohmann::json metadata = diskWrite.value("diagnosticMetaData", nlohmann::json::object());
    return "Disk writes " + textMember(metadata, "writesCaused") + "\n" + *frames;
}

std::optional<std::string> metricKitHangStack(const nlohmann::json &hang)
{
    std::optional<std::string> frames = attributedFrames(hang);
    if (!frames)
    {
        return std::nullopt;
    }

    nlohmann::json metadata = hang.value("diagnosticMetaData", nlohmann::json::object());
    return "Hang " + textMember(metadata, "hangDuration") + "\n" + *frames;
}
}
