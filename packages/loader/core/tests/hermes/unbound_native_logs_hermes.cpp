#include <chrono>
#include <cstdio>
#include <cstdlib>
#include <deque>
#include <filesystem>
#include <hermes/hermes.h>
#include <jsi/jsi.h>
#include <memory>
#include <mutex>
#include <nlohmann/json.hpp>
#include <string>
#include <thread>

#include "LoaderFiles.h"
#include "LoaderLogFile.h"
#include "LoaderLogStream.h"
#include "NativePluginRuntime.h"
#include "UnboundNativeBridge.h"

namespace fs  = std::filesystem;
namespace jsi = facebook::jsi;

static void require(bool condition, const std::string &check)
{
    if (!condition)
    {
        std::fprintf(stderr, "UnboundNative.logs check failed: %s\n", check.c_str());
        std::exit(1);
    }
}

// Queues runtime work and delayed work alike, so the test runs both on its own thread.
class QueuedExecutor final : public loader::native::NativePluginExecutor
{
public:
    bool isMainThread() override
    {
        return true;
    }

    void runOnMain(std::function<void()> work) override
    {
        work();
    }

    void runOnRuntime(std::function<void(jsi::Runtime &)> work) override
    {
        std::lock_guard<std::mutex> lock(mutex_);
        queued_.push_back(std::move(work));
    }

    void runAfter(double, std::function<void()> work) override
    {
        std::lock_guard<std::mutex> lock(mutex_);
        delayed_.push_back(std::move(work));
    }

    void drain(jsi::Runtime &runtime, const std::function<bool()> &settled)
    {
        auto deadline = std::chrono::steady_clock::now() + std::chrono::seconds(5);
        while (!settled() && std::chrono::steady_clock::now() < deadline)
        {
            std::deque<std::function<void()>> delayed;
            std::deque<std::function<void(jsi::Runtime &)>> work;
            {
                std::lock_guard<std::mutex> lock(mutex_);
                delayed.swap(delayed_);
            }

            for (auto &task : delayed)
            {
                task();
            }

            {
                std::lock_guard<std::mutex> lock(mutex_);
                work.swap(queued_);
            }

            for (auto &task : work)
            {
                task(runtime);
            }

            runtime.drainMicrotasks();
            std::this_thread::sleep_for(std::chrono::milliseconds(5));
        }
    }

private:
    std::mutex mutex_;
    std::deque<std::function<void()>> delayed_;
    std::deque<std::function<void(jsi::Runtime &)>> queued_;
};

static std::string evaluate(jsi::Runtime &runtime, const std::string &source)
{
    jsi::Value result =
        runtime.evaluateJavaScript(std::make_shared<jsi::StringBuffer>(source), "logs-checks.js");
    return result.isString() ? result.getString(runtime).utf8(runtime) : std::string();
}

static int receivedCount(jsi::Runtime &runtime)
{
    return static_cast<int>(
        runtime.global().getPropertyAsObject(runtime, "received").getArray(runtime).size(runtime));
}

int main()
{
    fs::path documents = fs::temp_directory_path() / "unbound-native-logs-hermes";
    fs::remove_all(documents);
    loader::openLogFile(documents.string());

    auto executor = std::make_shared<QueuedExecutor>();
    loader::native::setExecutor(executor);
    auto runtime = facebook::hermes::makeHermesRuntime(
        ::hermes::vm::RuntimeConfig::Builder().withMicrotaskQueue(true).build());
    loader::native::registerRuntime(*runtime);
    loader::installUnboundNative(*runtime, {});
    loader::installConsoleCapture(*runtime);

    evaluate(*runtime, "UnboundNative.log('warn', ['Logs', 'Test'], 'before subscribing')");
    require(!loader::logStream().active(), "nothing streams before a subscriber");
    require(evaluate(*runtime, "try { UnboundNative.log('loud', [], 'x'); 'accepted' } catch "
                               "(error) { 'refused' }")
                == "refused",
            "an unknown level is refused");

    evaluate(*runtime, "globalThis.received = [];"
                       "globalThis.unsubscribe = UnboundNative.logs.subscribe(function (entries) {"
                       "  entries.forEach(function (entry) { received.push(entry); });"
                       "});"
                       "UnboundNative.log('error', ['Logs'], 'live');"
                       "nativeLoggingHook('from console', 2);");
    loader::appendLogEntry({loader::logNow(),
                            loader::LogSource::ReactNative,
                            loader::LogLevel::Info,
                            {"RCTLog"},
                            "from native"});
    executor->drain(*runtime, [&] {
        return receivedCount(*runtime) >= 3;
    });
    require(evaluate(*runtime, "JSON.stringify(received.map(function (entry) {"
                               "  return [entry.src, entry.lvl, entry.scope.join('/'), entry.msg,"
                               "    typeof entry.t];"
                               "}))")
                == "[[\"unbound\",\"error\",\"Logs\",\"live\",\"number\"],"
                   "[\"js\",\"warn\",\"\",\"from console\",\"number\"],"
                   "[\"react-native\",\"info\",\"RCTLog\",\"from native\",\"number\"]]",
            "a subscriber receives every source in order, shaped as on disk");

    evaluate(*runtime, "unsubscribe(); unsubscribe(); UnboundNative.log('info', [], 'after');");
    require(!loader::logStream().active(), "the last unsubscribe stops the stream");
    int rounds = 0;
    executor->drain(*runtime, [&rounds] {
        return ++rounds > 10;
    });
    require(receivedCount(*runtime) == 3, "nothing arrives after unsubscribing");

    std::string unbound =
        loader::readTextFile((documents / "Logs" / "unbound.log").string()).value_or("");
    std::string native =
        loader::readTextFile((documents / "Logs" / "native.log").string()).value_or("");
    require(unbound.find("\"msg\":\"before subscribing\"") != std::string::npos
                && unbound.find("\"msg\":\"from console\"") != std::string::npos
                && unbound.find("\"msg\":\"after\"") != std::string::npos,
            "Unbound and console lines go to unbound.log");
    require(unbound.find("from native") == std::string::npos
                && native.find("\"src\":\"react-native\"") != std::string::npos,
            "React Native lines go to native.log");
    fs::remove_all(documents);
    std::printf("UnboundNative.logs: entries reach the files and live subscribers on Hermes\n");
    return 0;
}
