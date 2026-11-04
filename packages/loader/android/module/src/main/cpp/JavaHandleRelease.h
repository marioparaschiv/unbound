#pragma once

#include <atomic>
#include <cstdint>
#include <functional>
#include <nlohmann/json.hpp>
#include <string>
#include <utility>
#include <vector>

namespace unbound::android {
using JavaHandleReleaser = std::function<void(const std::string &id)>;
using GenerationSource   = uint64_t (*)();

inline void collectJavaHandleIssues(const nlohmann::json &value, std::vector<std::string> &issues)
{
    if (value.is_array())
    {
        for (const nlohmann::json &child : value)
        {
            collectJavaHandleIssues(child, issues);
        }
        return;
    }
    if (!value.is_object())
    {
        return;
    }
    auto type = value.find("type");
    auto id   = value.find("value");
    if (type != value.end() && type->is_string() && *type == "handle" && id != value.end() &&
        id->is_string() && id->get<std::string>().rfind("java-", 0) == 0)
    {
        issues.push_back(id->get<std::string>());
        return;
    }
    for (auto iterator = value.begin(); iterator != value.end(); ++iterator)
    {
        collectJavaHandleIssues(iterator.value(), issues);
    }
}

inline void releaseJavaHandleIssues(const JavaHandleReleaser &release, const std::string &payload)
{
    nlohmann::json parsed = nlohmann::json::parse(payload, nullptr, false);
    if (parsed.is_discarded())
    {
        return;
    }
    std::vector<std::string> issues;
    collectJavaHandleIssues(parsed, issues);
    for (const std::string &id : issues)
    {
        release(id);
    }
}

class PendingJavaPayload final
{
public:
    PendingJavaPayload(JavaHandleReleaser release, GenerationSource generation,
                       std::string payload = {})
        : release_(std::move(release)), generationSource_(generation), payload_(std::move(payload)),
          generation_(generation())
    {
    }

    ~PendingJavaPayload()
    {
        if (!transferred_.load(std::memory_order_acquire) && !payload_.empty() &&
            generation_ == generationSource_())
        {
            releaseJavaHandleIssues(release_, payload_);
        }
    }

    PendingJavaPayload(const PendingJavaPayload &)            = delete;
    PendingJavaPayload &operator=(const PendingJavaPayload &) = delete;

    const std::string &payload() const
    {
        return payload_;
    }

    void receive(std::string payload)
    {
        if (generation_ != generationSource_())
        {
            generation_ = kStaleGeneration;
        }
        payload_ = std::move(payload);
    }

    void transfer()
    {
        transferred_.store(true, std::memory_order_release);
    }

    std::string take()
    {
        transfer();
        return std::move(payload_);
    }

private:
    static constexpr uint64_t kStaleGeneration = UINT64_MAX;

    JavaHandleReleaser release_;
    GenerationSource   generationSource_;
    std::string        payload_;
    uint64_t           generation_;
    std::atomic_bool   transferred_{false};
};
}
