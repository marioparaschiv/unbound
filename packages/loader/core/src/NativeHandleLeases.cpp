#include "NativeHandleLeases.h"

#include <atomic>
#include <mutex>
#include <stdexcept>
#include <unordered_map>

#include "NativePlatformBridge.h"
#include "NativePluginRuntime.h"

namespace loader::native {
namespace jsi = facebook::jsi;

static constexpr size_t kMaximumAdoptedDepth = 128;

static std::atomic<size_t> gLeasedHandles{0};

size_t leasedHandleCount()
{
    return gLeasedHandles.load();
}

class HandleLeaseLedger final : public std::enable_shared_from_this<HandleLeaseLedger>
{
public:
    explicit HandleLeaseLedger(HandleRelease release) : release_(std::move(release)) {}

    uint64_t retain(const std::string &id)
    {
        std::lock_guard<std::mutex> lock(mutex_);
        forgetStaleGeneration();
        auto [found, inserted] = entries_.try_emplace(id);
        if (inserted)
        {
            gLeasedHandles++;
        }
        Entry &entry = found->second;
        entry.live++;
        entry.issues++;
        return generation_;
    }

    void drop(const std::string &id, uint64_t generation)
    {
        uint64_t issues = 0;
        {
            std::lock_guard<std::mutex> lock(mutex_);
            forgetStaleGeneration();
            if (generation != generation_)
            {
                return;
            }
            auto found = entries_.find(id);
            if (found == entries_.end() || --found->second.live > 0)
            {
                return;
            }
            issues = found->second.issues;
            entries_.erase(found);
            gLeasedHandles--;
        }
        scheduleRelease(id, issues);
    }

    size_t live() const
    {
        std::lock_guard<std::mutex> lock(mutex_);
        return generation_ == runtimeGeneration() ? entries_.size() : 0;
    }

private:
    struct Entry {
        uint64_t live   = 0;
        uint64_t issues = 0;
    };

    void forgetStaleGeneration()
    {
        uint64_t current = runtimeGeneration();
        if (current != generation_)
        {
            gLeasedHandles -= entries_.size();
            entries_.clear();
            generation_ = current;
        }
    }

    void scheduleRelease(const std::string &id, uint64_t issues)
    {
        auto target = executor();
        if (!target)
        {
            release_(id, issues);
            return;
        }
        target->runOnMain([ledger = shared_from_this(), id, issues]() {
            ledger->release_(id, issues);
        });
    }

    HandleRelease                          release_;
    mutable std::mutex                     mutex_;
    std::unordered_map<std::string, Entry> entries_;
    uint64_t                               generation_ = runtimeGeneration();
};

class HandleLease final : public jsi::NativeState
{
public:
    HandleLease(std::shared_ptr<HandleLeaseLedger> ledger, std::string id)
        : ledger_(std::move(ledger)), id_(std::move(id)), generation_(ledger_->retain(id_))
    {
    }

    ~HandleLease() override
    {
        ledger_->drop(id_, generation_);
    }

private:
    std::shared_ptr<HandleLeaseLedger> ledger_;
    std::string                        id_;
    uint64_t                           generation_;
};

HandleLeases::HandleLeases(HandleMatcher matcher, HandleRelease release)
    : matcher_(std::move(matcher)), ledger_(std::make_shared<HandleLeaseLedger>(std::move(release)))
{
}

jsi::Value HandleLeases::adopt(jsi::Runtime &runtime, const nlohmann::json &value) const
{
    return convert(runtime, value, 0);
}

size_t HandleLeases::liveHandles() const
{
    return ledger_->live();
}

jsi::Value HandleLeases::convert(jsi::Runtime &runtime, const nlohmann::json &value,
                                 size_t depth) const
{
    if (depth > kMaximumAdoptedDepth)
    {
        throw std::invalid_argument("A native result is nested too deeply");
    }
    if (value.is_array())
    {
        jsi::Array array(runtime, value.size());
        for (size_t index = 0; index < value.size(); index++)
        {
            array.setValueAtIndex(runtime, index, convert(runtime, value[index], depth + 1));
        }
        return array;
    }
    if (!value.is_object())
    {
        return toJSIValue(runtime, value);
    }
    if (std::optional<std::string> id = matcher_(value))
    {
        jsi::Object handle = toJSIValue(runtime, value).asObject(runtime);
        handle.setNativeState(runtime, std::make_shared<HandleLease>(ledger_, *id));
        return handle;
    }
    jsi::Object object(runtime);
    for (auto entry = value.begin(); entry != value.end(); ++entry)
    {
        object.setProperty(runtime, entry.key().c_str(),
                           convert(runtime, entry.value(), depth + 1));
    }
    return object;
}
}
