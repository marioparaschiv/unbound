#include "LoaderMetricKitCrash.h"

#include <cinttypes>
#include <cstdio>

namespace loader {
namespace {
    constexpr size_t kMaxFrames = 60;

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

std::optional<std::string> metricKitCrashStack(const nlohmann::json &crash)
{
    const nlohmann::json *thread = crash.is_object() ? crashingThread(crash) : nullptr;
    if (!thread)
    {
        return std::nullopt;
    }

    auto roots = thread->find("callStackRootFrames");
    if (roots == thread->end() || !roots->is_array() || roots->empty())
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

    const nlohmann::json *frame = &roots->front();
    for (size_t index = 0; frame && frame->is_object() && index < kMaxFrames; index++)
    {
        text += frameLine(index, *frame);
        auto children = frame->find("subFrames");
        frame         = children != frame->end() && children->is_array() && !children->empty()
                            ? &children->front()
                            : nullptr;
    }

    return text;
}
}
