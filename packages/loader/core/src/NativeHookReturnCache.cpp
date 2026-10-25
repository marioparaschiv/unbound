#include "NativeHookReturnCache.h"

#include "NativePluginRuntime.h"

#include <cmath>
#include <cstdint>

namespace loader::native
{
    static nlohmann::json normalized(const nlohmann::json &value)
    {
        if (value.is_number_float())
        {
            double number = value.get<double>();
            if (std::isfinite(number) && std::floor(number) == number && std::fabs(number) < 1e15)
            {
                return static_cast<int64_t>(number);
            }
            return value;
        }
        if (value.is_number_unsigned())
        {
            return value.get<uint64_t>() <= static_cast<uint64_t>(INT64_MAX)
                       ? nlohmann::json(static_cast<int64_t>(value.get<uint64_t>()))
                       : value;
        }
        if (value.is_array())
        {
            nlohmann::json result = nlohmann::json::array();
            for (const nlohmann::json &element : value)
            {
                result.push_back(normalized(element));
            }
            return result;
        }
        if (value.is_object())
        {
            nlohmann::json result = nlohmann::json::object();
            for (auto it = value.begin(); it != value.end(); ++it)
            {
                result[it.key()] = normalized(it.value());
            }
            return result;
        }
        return value;
    }

    std::string canonicalJSON(const nlohmann::json &value)
    {
        return normalized(value).dump();
    }

    HookReturnCache::HookReturnCache(NativeResourceBudget &budget) : budget_(budget)
    {
    }

    std::string HookReturnCache::key(const nlohmann::json &self, const nlohmann::json &arguments)
    {
        return canonicalJSON(self) + "|" + canonicalJSON(arguments);
    }

    void HookReturnCache::set(const std::string &token, const nlohmann::json &self,
                              const nlohmann::json &arguments, const nlohmann::json &value)
    {
        std::string                 entry = key(self, arguments);
        std::lock_guard<std::mutex> lock(mutex_);
        auto                       &bucket = entries_[token];
        if (!bucket.contains(entry) && !budget_.acquire())
        {
            if (bucket.empty())
            {
                entries_.erase(token);
            }
            throw NativeCodedError(kNativeBridgeErrorCode, "Too many cached native hook results");
        }
        bucket[entry] = value.dump();
    }

    bool HookReturnCache::remove(const std::string &token, const nlohmann::json &self,
                                 const nlohmann::json &arguments)
    {
        std::string                 entry = key(self, arguments);
        std::lock_guard<std::mutex> lock(mutex_);
        auto                        bucket = entries_.find(token);
        if (bucket == entries_.end() || bucket->second.erase(entry) == 0)
        {
            return false;
        }
        if (bucket->second.empty())
        {
            entries_.erase(bucket);
        }
        budget_.release();
        return true;
    }

    size_t HookReturnCache::clear(const std::string &token)
    {
        std::lock_guard<std::mutex> lock(mutex_);
        auto                        bucket = entries_.find(token);
        if (bucket == entries_.end())
        {
            return 0;
        }
        size_t count = bucket->second.size();
        entries_.erase(bucket);
        budget_.release(count);
        return count;
    }

    size_t HookReturnCache::clearAll()
    {
        std::lock_guard<std::mutex> lock(mutex_);
        size_t                      count = 0;
        for (const auto &[token, bucket] : entries_)
        {
            count += bucket.size();
        }
        entries_.clear();
        budget_.release(count);
        return count;
    }

    std::optional<std::string> HookReturnCache::find(const std::string &token, const nlohmann::json &self,
                                                     const nlohmann::json &arguments) const
    {
        std::string                 entry = key(self, arguments);
        std::lock_guard<std::mutex> lock(mutex_);
        auto                        bucket = entries_.find(token);
        if (bucket == entries_.end())
        {
            return std::nullopt;
        }
        auto found = bucket->second.find(entry);
        if (found == bucket->second.end())
        {
            return std::nullopt;
        }
        return found->second;
    }

    std::optional<std::string> HookReturnCache::findSerialized(const std::string &token,
                                                               const std::string &selfJSON,
                                                               const std::string &argumentsJSON) const
    {
        {
            std::lock_guard<std::mutex> lock(mutex_);
            if (!entries_.contains(token))
            {
                return std::nullopt;
            }
        }
        nlohmann::json self      = nlohmann::json::parse(selfJSON, nullptr, false);
        nlohmann::json arguments = nlohmann::json::parse(argumentsJSON, nullptr, false);
        if (self.is_discarded() || arguments.is_discarded())
        {
            return std::nullopt;
        }
        return find(token, self, arguments);
    }

    size_t HookReturnCache::size() const
    {
        std::lock_guard<std::mutex> lock(mutex_);
        size_t                      count = 0;
        for (const auto &[token, bucket] : entries_)
        {
            count += bucket.size();
        }
        return count;
    }
}
