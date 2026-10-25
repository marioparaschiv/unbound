#include "NativeTraversalOptions.h"

#include <cmath>
#include <stdexcept>
#include <string>

namespace loader::native
{
    namespace jsi = facebook::jsi;

    static constexpr TraversalLimits kSnapshotLimits = {
        {"maxDepth", 8, 0, 12},
        {"maxNodes", 100, 1, 256},
        {nullptr, 0, 0, 0},
        false,
    };

    static constexpr TraversalLimits kSearchLimits = {
        {"maxDepth", 24, 0, 40},
        {"maxVisited", 512, 1, 2048},
        {"maxResults", 64, 1, 256},
        true,
    };

    static constexpr TraversalLimits kQueryLimits = {
        {"maxDepth", 16, 0, 64},
        {"maxNodes", 512, 1, 2000},
        {"maxResults", 128, 1, 500},
        false,
    };

    static constexpr const char *kSearchFlagKeys[] = {"attachedOnly", "stopAtMatch", "direction"};

    const TraversalLimits &traversalLimits(TraversalProfile profile)
    {
        switch (profile)
        {
        case TraversalProfile::Snapshot:
            return kSnapshotLimits;
        case TraversalProfile::Search:
            return kSearchLimits;
        case TraversalProfile::Query:
            break;
        }
        return kQueryLimits;
    }

    static const nlohmann::json *presentField(const nlohmann::json &options, const char *key)
    {
        if (!key || !options.is_object())
        {
            return nullptr;
        }
        auto found = options.find(key);
        if (found == options.end() || found->is_null())
        {
            return nullptr;
        }
        return &*found;
    }

    static uint32_t boundedCount(const nlohmann::json &options, const TraversalLimit &limit)
    {
        const nlohmann::json *value = presentField(options, limit.key);
        if (!value)
        {
            return limit.fallback;
        }
        if (!value->is_number())
        {
            throw std::invalid_argument(std::string(limit.key) + " must be a number");
        }

        double number = value->get<double>();
        if (!std::isfinite(number) || std::floor(number) != number)
        {
            throw std::invalid_argument(std::string(limit.key) + " must be a finite integer");
        }
        if (number < limit.minimum)
        {
            return limit.minimum;
        }
        if (number > limit.maximum)
        {
            return limit.maximum;
        }
        return static_cast<uint32_t>(number);
    }

    static bool flag(const nlohmann::json &options, const char *key)
    {
        const nlohmann::json *value = presentField(options, key);
        if (!value)
        {
            return false;
        }
        if (!value->is_boolean())
        {
            throw std::invalid_argument(std::string(key) + " must be a boolean");
        }
        return value->get<bool>();
    }

    static TraversalDirection direction(const nlohmann::json &options)
    {
        const nlohmann::json *value = presentField(options, "direction");
        if (!value)
        {
            return TraversalDirection::Descendants;
        }
        if (value->is_string())
        {
            const std::string &name = value->get_ref<const std::string &>();
            if (name == "descendants")
            {
                return TraversalDirection::Descendants;
            }
            if (name == "ancestors")
            {
                return TraversalDirection::Ancestors;
            }
        }
        throw std::invalid_argument("direction must be descendants or ancestors");
    }

    TraversalOptions parseTraversalOptions(const nlohmann::json &options, TraversalProfile profile)
    {
        if (!options.is_null() && !options.is_object())
        {
            throw std::invalid_argument("traversal options must be an object");
        }

        const TraversalLimits &limits = traversalLimits(profile);
        TraversalOptions       result;
        result.maxDepth   = boundedCount(options, limits.depth);
        result.maxNodes   = boundedCount(options, limits.nodes);
        result.maxResults = boundedCount(options, limits.results);
        if (limits.searchFlags)
        {
            result.attachedOnly = flag(options, "attachedOnly");
            result.stopAtMatch  = flag(options, "stopAtMatch");
            result.direction    = direction(options);
        }
        return result;
    }

    static nlohmann::json scalarField(jsi::Runtime &runtime, const jsi::Value &value)
    {
        if (value.isNull())
        {
            return nullptr;
        }
        if (value.isNumber())
        {
            return value.getNumber();
        }
        if (value.isBool())
        {
            return value.getBool();
        }
        if (value.isString())
        {
            return value.getString(runtime).utf8(runtime);
        }
        return nlohmann::json::object();
    }

    static void copyField(jsi::Runtime &runtime, const jsi::Object &source, const char *key,
                          nlohmann::json &target)
    {
        if (!key)
        {
            return;
        }
        jsi::Value value = source.getProperty(runtime, key);
        if (!value.isUndefined())
        {
            target[key] = scalarField(runtime, value);
        }
    }

    TraversalOptions parseTraversalOptions(jsi::Runtime &runtime, const jsi::Value &options,
                                           TraversalProfile profile)
    {
        if (options.isUndefined() || options.isNull())
        {
            return parseTraversalOptions(nlohmann::json(nullptr), profile);
        }
        if (!options.isObject())
        {
            throw std::invalid_argument("traversal options must be an object");
        }

        const TraversalLimits &limits = traversalLimits(profile);
        jsi::Object            source = options.asObject(runtime);
        nlohmann::json         fields = nlohmann::json::object();
        copyField(runtime, source, limits.depth.key, fields);
        copyField(runtime, source, limits.nodes.key, fields);
        copyField(runtime, source, limits.results.key, fields);
        if (limits.searchFlags)
        {
            for (const char *key : kSearchFlagKeys)
            {
                copyField(runtime, source, key, fields);
            }
        }
        return parseTraversalOptions(fields, profile);
    }
}
