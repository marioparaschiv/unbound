#include "LoaderHotReload.h"
#include "LoaderSettings.h"

#include <algorithm>
#include <cassert>
#include <deque>
#include <filesystem>
#include <string>
#include <unistd.h>
#include <vector>

struct ScheduledWork
{
    double                seconds;
    std::function<void()> work;
};

struct FakeScheduler
{
    std::deque<ScheduledWork> pending;

    loader::HotReloadScheduler scheduler()
    {
        return [this](double seconds, std::function<void()> work) {
            pending.push_back({seconds, std::move(work)});
        };
    }

    double runNext()
    {
        assert(!pending.empty());
        ScheduledWork next = std::move(pending.front());
        pending.pop_front();
        next.work();
        return next.seconds;
    }

    double nextDelay() const
    {
        assert(!pending.empty());
        return pending.front().seconds;
    }

    void runImmediate()
    {
        for (auto immediate = findImmediate(); immediate != pending.end(); immediate = findImmediate())
        {
            std::function<void()> work = std::move(immediate->work);
            pending.erase(immediate);
            work();
        }
    }

    std::deque<ScheduledWork>::iterator findImmediate()
    {
        return std::find_if(pending.begin(), pending.end(),
                            [](const ScheduledWork &work) { return work.seconds == 0; });
    }

    void dropTimeouts()
    {
        std::erase_if(pending, [](const ScheduledWork &work) {
            return work.seconds == loader::kHotReloadConnectTimeoutSeconds;
        });
    }
};

struct FakeTransport : loader::HotReloadTransport
{
    std::vector<loader::HotReloadRequest> opened;
    int                                   cancelled = 0;

    void open(const loader::HotReloadRequest &request) override
    {
        opened.push_back(request);
    }

    void cancel() override
    {
        cancelled++;
    }

    uint64_t last() const
    {
        assert(!opened.empty());
        return opened.back().connection;
    }
};

static std::string temporarySettingsPath()
{
    std::string templatePath =
        (std::filesystem::temp_directory_path() / "loader-hot-reload-XXXXXX").string();
    char *directory = mkdtemp(templatePath.data());
    assert(directory);
    return (std::filesystem::path(directory) / "settings.json").string();
}

static std::string reloadEvent(const std::string &etag)
{
    return "event: reload\ndata: {\"etag\":\"" + etag + "\"}\n\n";
}

int main()
{
    loader::SettingsStore settings(temporarySettingsPath());
    settings.load();
    settings.set("unbound", "loader.update.etag", "\"1\"");

    FakeScheduler                  scheduler;
    auto                           transport = std::make_shared<FakeTransport>();
    std::optional<std::string>     base      = std::string("http://10.0.2.2:3000/unbound.js");
    int                            reloads   = 0;
    auto controller = std::make_shared<loader::HotReloadController>(
        settings, [&base] { return base; }, transport, scheduler.scheduler(), [&reloads] { reloads++; });

    controller->sync();
    assert(scheduler.pending.size() == 1 && scheduler.nextDelay() == 0);
    scheduler.runImmediate();
    assert(!controller->isRunning());
    assert(transport->opened.empty());

    settings.set("unbound", "loader.update.hmr", true);
    settings.set("unbound", "loader.enabled", false);
    controller->sync();
    scheduler.runImmediate();
    assert(!controller->isRunning());
    assert(transport->opened.empty());

    settings.set("unbound", "loader.enabled", true);
    base = std::nullopt;
    controller->sync();
    scheduler.runImmediate();
    assert(!controller->isRunning());
    assert(transport->opened.empty());

    base = std::string("http://10.0.2.2:3000/unbound.js");
    controller->sync();
    scheduler.runImmediate();
    assert(controller->isRunning());
    assert(transport->opened.size() == 1);
    const loader::HotReloadRequest &request = transport->opened.front();
    assert(request.url == "http://10.0.2.2:3000/__hot");
    assert(request.headers.at("Accept") == "text/event-stream");
    assert(request.headers.at("Cache-Control") == "no-cache");
    assert(request.connectTimeoutSeconds == loader::kHotReloadConnectTimeoutSeconds);
    assert(request.readTimeoutSeconds == loader::kHotReloadReadTimeoutSeconds);
    assert(scheduler.pending.size() == 1 && scheduler.nextDelay() == loader::kHotReloadConnectTimeoutSeconds);

    controller->sync();
    scheduler.runImmediate();
    assert(transport->opened.size() == 1);

    uint64_t first = transport->last();
    assert(!controller->onChunk(first, reloadEvent("2")));
    assert(controller->onResponse(first, 200));
    assert(!controller->onResponse(first, 200));
    assert(controller->onChunk(first, reloadEvent("1")));
    assert(reloads == 0);
    assert(controller->onChunk(first, "event: reload\ndata: {\"etag\":"));
    assert(controller->onChunk(first, "\"2\"}\n\n"));
    assert(reloads == 1);

    scheduler.runNext();
    assert(transport->cancelled == 0);
    assert(scheduler.pending.empty());

    controller->onClosed(first, std::nullopt);
    assert(scheduler.pending.size() == 1 && scheduler.nextDelay() == 1.0);
    controller->onClosed(first, std::string("late"));
    assert(scheduler.pending.size() == 1);
    scheduler.runNext();
    assert(transport->opened.size() == 2);
    scheduler.dropTimeouts();

    uint64_t second = transport->last();
    assert(second != first);
    assert(!controller->onChunk(first, reloadEvent("3")));
    assert(!controller->onResponse(second, 503));
    assert(!controller->onChunk(second, reloadEvent("3")));
    assert(scheduler.pending.size() == 1 && scheduler.nextDelay() == 2.0);
    controller->onClosed(second, std::string("cancelled"));
    assert(scheduler.pending.size() == 1);
    scheduler.runNext();
    scheduler.dropTimeouts();

    uint64_t third = transport->last();
    controller->onClosed(third, std::string("connection refused"));
    assert(scheduler.nextDelay() == 4.0);
    scheduler.runNext();
    scheduler.dropTimeouts();

    uint64_t fourth = transport->last();
    assert(controller->onResponse(fourth, 200));
    controller->onClosed(fourth, std::string("reset"));
    assert(scheduler.nextDelay() == 1.0);
    scheduler.runNext();
    assert(scheduler.nextDelay() == loader::kHotReloadConnectTimeoutSeconds);

    uint64_t fifth = transport->last();
    scheduler.runNext();
    assert(transport->cancelled == 1);
    assert(scheduler.nextDelay() == 2.0);
    assert(!controller->onResponse(fifth, 200));
    controller->onClosed(fifth, std::string("cancelled"));
    assert(scheduler.pending.size() == 1);

    settings.set("unbound", "loader.update.hmr", false);
    controller->sync();
    scheduler.runImmediate();
    assert(!controller->isRunning());
    assert(transport->cancelled == 2);
    size_t openedBeforeStop = transport->opened.size();
    scheduler.runNext();
    assert(transport->opened.size() == openedBeforeStop);

    settings.set("unbound", "loader.update.hmr", true);
    controller->sync();
    scheduler.runImmediate();
    assert(controller->isRunning());
    assert(transport->opened.size() == openedBeforeStop + 1);
    uint64_t restarted = transport->last();
    assert(!controller->onResponse(fifth, 200));
    assert(controller->onResponse(restarted, 200));
    controller->onClosed(restarted, std::string("reset"));
    assert(scheduler.pending.back().seconds == 1.0);

    settings.set("unbound", "loader.enabled", false);
    controller->sync();
    scheduler.runImmediate();
    assert(!controller->isRunning());

    settings.set("unbound", "loader.enabled", true);
    controller->sync();
    controller.reset();
    while (!scheduler.pending.empty())
    {
        scheduler.runNext();
    }
    assert(transport->opened.size() == openedBeforeStop + 1);
    return 0;
}
