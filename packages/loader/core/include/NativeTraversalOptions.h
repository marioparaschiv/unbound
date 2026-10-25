#pragma once

#include <cstdint>
#include <jsi/jsi.h>
#include <nlohmann/json.hpp>

namespace loader::native {
enum class TraversalProfile
{
    Snapshot,
    Search,
    Query,
};

enum class TraversalDirection
{
    Descendants,
    Ancestors,
};

struct TraversalLimit {
    const char *key;
    uint32_t    fallback;
    uint32_t    minimum;
    uint32_t    maximum;
};

struct TraversalLimits {
    TraversalLimit depth;
    TraversalLimit nodes;
    TraversalLimit results;
    bool           searchFlags;
};

struct TraversalOptions {
    uint32_t           maxDepth     = 0;
    uint32_t           maxNodes     = 0;
    uint32_t           maxResults   = 0;
    bool               attachedOnly = false;
    bool               stopAtMatch  = false;
    TraversalDirection direction    = TraversalDirection::Descendants;
};

const TraversalLimits &traversalLimits(TraversalProfile profile);

TraversalOptions parseTraversalOptions(const nlohmann::json &options, TraversalProfile profile);
TraversalOptions parseTraversalOptions(facebook::jsi::Runtime     &runtime,
                                       const facebook::jsi::Value &options,
                                       TraversalProfile            profile);
}
