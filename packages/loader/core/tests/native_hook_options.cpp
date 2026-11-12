#include <cassert>
#include <cmath>
#include <functional>
#include <limits>
#include <stdexcept>
#include <string>

#include "NativeHookOptions.h"

using loader::native::cacheableHookResult;
using loader::native::HookFlags;
using loader::native::HookHandlers;
using loader::native::HookPayload;
using loader::native::HookPayloadPhase;
using loader::native::parseHookFlags;
using loader::native::parseHookPayload;
using loader::native::payloadArgumentIndexes;
using loader::native::selectedPayloadArgument;
using loader::native::validateHookHandlers;

static std::string rejection(const std::function<void()> &parse)
{
    try
    {
        parse();
    }
    catch (const std::invalid_argument &error)
    {
        return error.what();
    }
    return "";
}

static std::string payloadRejection(const nlohmann::json &payload, size_t explicitArguments = 2)
{
    return rejection([&] {
        parseHookPayload({{"payload", payload}}, explicitArguments);
    });
}

int main()
{
    HookFlags defaults = parseHookFlags(nlohmann::json::object());
    assert(!defaults.once && !defaults.cacheOnly && !defaults.coalesceAfter);
    HookFlags flags =
        parseHookFlags({{"once", true}, {"cacheOnly", true}, {"coalesce", "receiver"}});
    assert(flags.once && flags.cacheOnly && flags.coalesceAfter);
    HookFlags loose = parseHookFlags({{"once", 1}, {"cacheOnly", "yes"}, {"coalesce", nullptr}});
    assert(!loose.once && !loose.cacheOnly && !loose.coalesceAfter);
    assert(rejection([] {
               parseHookFlags({{"coalesce", "self"}});
           }) == "Native hook coalescing must be set to receiver");
    assert(rejection([] {
               parseHookFlags({{"coalesce", true}});
           }) == "Native hook coalescing must be set to receiver");

    HookPayload absent = parseHookPayload(nlohmann::json::object(), 2);
    assert(absent.receiver && absent.allArguments && absent.argumentIndexes.empty());
    assert(absent.phase == HookPayloadPhase::both);
    HookPayload nullPayload = parseHookPayload({{"payload", nullptr}}, 2);
    assert(nullPayload.allArguments);

    HookPayload selected = parseHookPayload(
        {{"payload", {{"receiver", false}, {"arguments", {1, 0}}, {"phase", "after"}}}}, 2);
    assert(!selected.receiver && !selected.allArguments);
    assert((selected.argumentIndexes == std::vector<size_t>{1, 0}));
    assert(selected.phase == HookPayloadPhase::after);
    assert(parseHookPayload({{"payload", {{"phase", "before"}}}}, 0).phase ==
           HookPayloadPhase::before);
    HookPayload none = parseHookPayload({{"payload", {{"arguments", nlohmann::json::array()}}}}, 2);
    assert(!none.allArguments && none.argumentIndexes.empty());

    assert(payloadRejection(nlohmann::json::array()) ==
           "Native hook payload options must be an object");
    assert(payloadRejection("receiver") == "Native hook payload options must be an object");
    assert(payloadRejection({{"receiver", nullptr}}) ==
           "Native hook payload receiver must be boolean");
    assert(payloadRejection({{"arguments", 1}}) ==
           "Native hook payload arguments must be an array");
    assert(payloadRejection({{"arguments", {"0"}}}) ==
           "Native hook payload argument indexes must be integers");
    assert(payloadRejection({{"arguments", {2}}}) ==
           "Native hook payload argument index is out of range");
    assert(payloadRejection({{"arguments", {-1}}}) ==
           "Native hook payload argument index is out of range");
    assert(payloadRejection({{"arguments", {0.5}}}) ==
           "Native hook payload argument index is out of range");
    assert(payloadRejection({{"arguments", {std::numeric_limits<double>::infinity()}}}) ==
           "Native hook payload argument index is out of range");
    assert(payloadRejection({{"arguments", {1, 1}}}) ==
           "Native hook payload argument indexes must be unique");
    assert(payloadRejection({{"phase", 1}}) == "Native hook payload phase must be a string");
    assert(payloadRejection({{"phase", "both"}}) ==
           "Native hook payload phase must be before or after");

    for (const char *result : {"bool", "i8", "u8", "i16", "u16", "i32", "u32", "i64", "u64",
                               "float", "double", "struct:CGRect"})
    {
        assert(cacheableHookResult(result));
    }
    for (const char *result : {"void", "object", "class", "selector", "pointer", "cstring"})
    {
        assert(!cacheableHookResult(result));
    }

    HookFlags   coalescing{false, false, true};
    HookFlags   cacheOnly{false, true, false};
    HookPayload everything;
    HookPayload beforeOnly;
    beforeOnly.phase = HookPayloadPhase::before;
    HookPayload anonymous;
    anonymous.receiver = false;
    HookHandlers      after{false, true, false};
    HookHandlers      replacing{false, true, true};
    HookHandlers      nothing;
    const std::string coalesceFailure =
        "Receiver coalescing requires a non-replacing after-observation hook with its receiver";
    const std::string cacheFailure =
        "Native cache-only hooks require a scalar or struct return type";
    assert(rejection([&] {
               validateHookHandlers(after, coalescing, everything, "void");
           }).empty());
    assert(rejection([&] {
               validateHookHandlers(replacing, coalescing, everything, "void");
           }) == coalesceFailure);
    assert(rejection([&] {
               validateHookHandlers(nothing, coalescing, everything, "void");
           }) == coalesceFailure);
    assert(rejection([&] {
               validateHookHandlers(after, coalescing, beforeOnly, "void");
           }) == coalesceFailure);
    assert(rejection([&] {
               validateHookHandlers(after, coalescing, anonymous, "void");
           }) == coalesceFailure);
    assert(rejection([&] {
               validateHookHandlers(nothing, cacheOnly, everything, "i32");
           }).empty());
    assert(rejection([&] {
               validateHookHandlers(nothing, cacheOnly, everything, "object");
           }) == cacheFailure);
    assert(rejection([&] {
               validateHookHandlers(after, cacheOnly, everything, "i32");
           }) == cacheFailure);

    assert((payloadArgumentIndexes(everything, 3) == std::vector<size_t>{0, 1, 2}));
    assert(payloadArgumentIndexes(everything, 0).empty());
    assert((payloadArgumentIndexes(selected, 3) == std::vector<size_t>{1, 0}));

    assert(selectedPayloadArgument(0, 2) == 0);
    assert(selectedPayloadArgument(1, 2) == 1);
    assert(rejection([] {
               selectedPayloadArgument(2, 2);
           }) == "Native hook argument index is out of range");
    assert(rejection([] {
               selectedPayloadArgument(-1, 2);
           }) == "Native hook argument index is out of range");
    assert(rejection([] {
               selectedPayloadArgument(std::nan(""), 2);
           }) == "Native hook argument index is out of range");
    assert(rejection([] {
               selectedPayloadArgument(0.5, 2);
           }) == "Native hook argument index must be an integer");
}
