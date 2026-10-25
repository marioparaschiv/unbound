#include "NativeTraversalOptions.h"

#include <cassert>
#include <limits>
#include <stdexcept>

using loader::native::parseTraversalOptions;
using loader::native::TraversalDirection;
using loader::native::TraversalProfile;

static bool rejects(const nlohmann::json &options, TraversalProfile profile)
{
    try
    {
        parseTraversalOptions(options, profile);
    }
    catch (const std::invalid_argument &)
    {
        return true;
    }
    return false;
}

int main()
{
    auto snapshot = parseTraversalOptions(nlohmann::json(nullptr), TraversalProfile::Snapshot);
    assert(snapshot.maxDepth == 8 && snapshot.maxNodes == 100);

    auto search = parseTraversalOptions(nlohmann::json::object(), TraversalProfile::Search);
    assert(search.maxDepth == 24 && search.maxNodes == 512 && search.maxResults == 64);
    assert(!search.attachedOnly && !search.stopAtMatch);
    assert(search.direction == TraversalDirection::Descendants);

    auto query = parseTraversalOptions(nlohmann::json::object(), TraversalProfile::Query);
    assert(query.maxDepth == 16 && query.maxNodes == 512 && query.maxResults == 128);

    auto clamped = parseTraversalOptions({{"maxDepth", 99}, {"maxNodes", 0}}, TraversalProfile::Snapshot);
    assert(clamped.maxDepth == 12 && clamped.maxNodes == 1);

    auto lowered = parseTraversalOptions({{"maxDepth", -4}, {"maxNodes", 5000}, {"maxResults", 900}},
                                         TraversalProfile::Query);
    assert(lowered.maxDepth == 0 && lowered.maxNodes == 2000 && lowered.maxResults == 500);

    auto visited = parseTraversalOptions({{"maxVisited", 4096}, {"maxNodes", 3}}, TraversalProfile::Search);
    assert(visited.maxNodes == 2048);

    auto exact = parseTraversalOptions({{"maxDepth", 3}, {"maxNodes", 40}, {"maxResults", 2}},
                                       TraversalProfile::Query);
    assert(exact.maxDepth == 3 && exact.maxNodes == 40 && exact.maxResults == 2);

    auto nulls = parseTraversalOptions({{"maxDepth", nullptr}, {"attachedOnly", nullptr}}, TraversalProfile::Search);
    assert(nulls.maxDepth == 24 && !nulls.attachedOnly);

    auto flags = parseTraversalOptions(
        {{"attachedOnly", true}, {"stopAtMatch", true}, {"direction", "ancestors"}}, TraversalProfile::Search);
    assert(flags.attachedOnly && flags.stopAtMatch && flags.direction == TraversalDirection::Ancestors);

    auto ignoredFlags = parseTraversalOptions({{"attachedOnly", "yes"}, {"maxResults", 2}}, TraversalProfile::Snapshot);
    assert(!ignoredFlags.attachedOnly && ignoredFlags.maxResults == 0);

    assert(rejects({{"maxDepth", 2.5}}, TraversalProfile::Snapshot));
    assert(rejects({{"maxDepth", "4"}}, TraversalProfile::Query));
    assert(rejects({{"maxNodes", std::numeric_limits<double>::infinity()}}, TraversalProfile::Query));
    assert(rejects({{"maxNodes", std::numeric_limits<double>::quiet_NaN()}}, TraversalProfile::Snapshot));
    assert(rejects({{"attachedOnly", 1}}, TraversalProfile::Search));
    assert(rejects({{"direction", "sideways"}}, TraversalProfile::Search));
    assert(rejects(nlohmann::json::array(), TraversalProfile::Search));
}
