#include "UnboundNativeLogs.h"

#include <cstdint>
#include <functional>
#include <map>
#include <memory>
#include <optional>
#include <string>
#include <utility>
#include <vector>

#include "LoaderJSIJSON.h"
#include "LoaderLog.h"
#include "LoaderLogFile.h"
#include "LoaderLogRateLimit.h"
#include "LoaderLogStream.h"
#include "NativePluginRuntime.h"

namespace loader {
namespace jsi = facebook::jsi;

// One runtime's subscribers, touched only on its thread. The bridge's functions own it, so it dies
// with the runtime; the stream reaches it through a weak pointer.
struct LogSubscribers {
    uint64_t next = 0;
    std::map<uint64_t, std::shared_ptr<jsi::Function>> callbacks;
};

static void deliver(const std::weak_ptr<LogSubscribers> &weak, std::vector<LogEntry> batch)
{
    if (weak.expired())
    {
        logStream().stop();
        return;
    }

    native::executeRuntimeAsynchronously([weak, batch = std::move(batch)](jsi::Runtime &runtime) {
        std::shared_ptr<LogSubscribers> subscribers = weak.lock();
        if (!subscribers || subscribers->callbacks.empty())
        {
            return;
        }

        nlohmann::json entries = nlohmann::json::array();
        for (const LogEntry &entry : batch)
        {
            entries.push_back(logEntryJSON(entry));
        }

        jsi::Value value = toJSIValue(runtime, entries);
        std::vector<std::shared_ptr<jsi::Function>> callbacks;
        for (const auto &[id, callback] : subscribers->callbacks)
        {
            callbacks.push_back(callback);
        }

        for (const std::shared_ptr<jsi::Function> &callback : callbacks)
        {
            try
            {
                callback->call(runtime, value);
            }
            catch (const std::exception &)
            {
                // A subscriber reports its own failures; logging one here would feed the stream
                // that delivered it and repeat every batch.
            }
        }
    });
}

static void startStream(const std::weak_ptr<LogSubscribers> &weak)
{
    logStream().start(
        [weak](std::vector<LogEntry> batch) {
            deliver(weak, std::move(batch));
        },
        [](std::function<void()> work) {
            if (std::shared_ptr<native::NativePluginExecutor> target = native::executor())
            {
                target->runAfter(kLogStreamBatchSeconds, std::move(work));
            }
        });
}

static std::vector<std::string> scopeArgument(jsi::Runtime &runtime, const jsi::Value &value)
{
    std::vector<std::string> scope;
    if (!value.isObject() || !value.getObject(runtime).isArray(runtime))
    {
        return scope;
    }

    jsi::Array parts = value.getObject(runtime).getArray(runtime);
    for (size_t index = 0, size = parts.size(runtime); index < size; index++)
    {
        jsi::Value part = parts.getValueAtIndex(runtime, index);
        if (part.isString())
        {
            scope.push_back(part.getString(runtime).utf8(runtime));
        }
    }

    return scope;
}

static jsi::Function logFunction(jsi::Runtime &runtime)
{
    return native::makeFunction(
        runtime, "log", 3,
        [](jsi::Runtime &rt, const jsi::Value &, const jsi::Value *args,
           size_t count) -> jsi::Value {
            if (count < 3 || !args[0].isString() || !args[2].isString())
            {
                throw jsi::JSError(rt, "log expects a level, a scope and a message");
            }

            std::optional<LogLevel> level = logLevelFromName(args[0].getString(rt).utf8(rt));
            if (!level)
            {
                throw jsi::JSError(rt, "log expects debug, info, warn or error");
            }

            std::vector<std::string> scope = scopeArgument(rt, args[1]);
            std::string message            = args[2].getString(rt).utf8(rt);
            LogAdmission admission =
                jsLogRateLimiter().admit(scope.empty() ? "" : scope.front(), logNow());
            if (admission.summary)
            {
                writeSystemLog(LogLevel::Warning, scopedLogLine(scope, *admission.summary));
                appendLogEntry(
                    {logNow(), LogSource::Unbound, LogLevel::Warning, scope, *admission.summary});
            }

            if (!admission.write)
            {
                return jsi::Value::undefined();
            }

            writeSystemLog(*level, scopedLogLine(scope, message));
            appendLogEntry(
                {logNow(), LogSource::Unbound, *level, std::move(scope), std::move(message)});
            return jsi::Value::undefined();
        });
}

static jsi::Function unsubscribeFunction(jsi::Runtime &runtime, std::weak_ptr<LogSubscribers> weak,
                                         uint64_t id)
{
    return native::makeFunction(runtime, "unsubscribe", 0,
                                [weak = std::move(weak), id](jsi::Runtime &, const jsi::Value &,
                                                             const jsi::Value *,
                                                             size_t) -> jsi::Value {
                                    std::shared_ptr<LogSubscribers> subscribers = weak.lock();
                                    if (subscribers && subscribers->callbacks.erase(id) > 0
                                        && subscribers->callbacks.empty())
                                    {
                                        logStream().stop();
                                    }

                                    return jsi::Value::undefined();
                                });
}

static jsi::Function subscribeFunction(jsi::Runtime &runtime)
{
    auto subscribers = std::make_shared<LogSubscribers>();
    return native::makeFunction(
        runtime, "subscribe", 1,
        [subscribers](jsi::Runtime &rt, const jsi::Value &, const jsi::Value *args,
                      size_t count) -> jsi::Value {
            if (count < 1 || !args[0].isObject() || !args[0].getObject(rt).isFunction(rt))
            {
                throw jsi::JSError(rt, "logs.subscribe expects a function");
            }

            uint64_t id = ++subscribers->next;
            bool first  = subscribers->callbacks.empty();
            subscribers->callbacks[id] =
                std::make_shared<jsi::Function>(args[0].getObject(rt).getFunction(rt));
            if (first)
            {
                startStream(subscribers);
            }

            return unsubscribeFunction(rt, subscribers, id);
        });
}

void installLogBridge(jsi::Runtime &runtime, jsi::Object &bridge)
{
    // A new runtime starts with no subscribers; the previous one's went with it.
    logStream().stop();
    bridge.setProperty(runtime, "log", logFunction(runtime));
    jsi::Object logs(runtime);
    logs.setProperty(runtime, "subscribe", subscribeFunction(runtime));
    bridge.setProperty(runtime, "logs", std::move(logs));
}
}
