#pragma once

#include <cstdint>
#include <functional>
#include <map>
#include <memory>
#include <mutex>
#include <optional>
#include <string>
#include <string_view>

#include "LoaderSettings.h"
#include "LoaderUpdater.h"

namespace loader {
constexpr int    kDevServerPort                  = 3000;
constexpr double kDevServerProbeTimeoutSeconds   = 1.5;
constexpr double kHotReloadMinimumDelaySeconds   = 1.0;
constexpr double kHotReloadMaximumDelaySeconds   = 30.0;
constexpr double kHotReloadConnectTimeoutSeconds = 5.0;
constexpr double kHotReloadReadTimeoutSeconds    = 86400.0;

using ReachabilityProbe = std::function<bool(const std::string &url, double timeoutSeconds)>;

std::optional<std::string> resolveUpdateURL(const UpdaterSettings            &settings,
                                            const std::optional<std::string> &devServerHost,
                                            const ReachabilityProbe          &isServing);
std::optional<std::string> hotReloadURL(const std::string &base);
std::string                normalizedEtag(std::string_view etag);
std::optional<std::string> hotReloadEtag(std::string_view event);
bool hotReloadEventRequiresReload(const UpdaterSettings &settings, std::string_view event);

class HotReloadBackoff
{
public:
    double next();
    void   reset();

private:
    double delay_ = kHotReloadMinimumDelaySeconds;
};

class HotReloadStream
{
public:
    explicit HotReloadStream(UpdaterSettings settings);

    bool feed(std::string_view chunk);
    void reset();

private:
    UpdaterSettings settings_;
    std::string     buffer_;
};

struct HotReloadRequest {
    uint64_t                           connection = 0;
    std::string                        url;
    std::map<std::string, std::string> headers;
    double                             connectTimeoutSeconds = kHotReloadConnectTimeoutSeconds;
    double                             readTimeoutSeconds    = kHotReloadReadTimeoutSeconds;
};

class HotReloadTransport
{
public:
    virtual ~HotReloadTransport() = default;

    virtual void open(const HotReloadRequest &request) = 0;
    virtual void cancel()                              = 0;
};

using HotReloadURLResolver = std::function<std::optional<std::string>()>;
using HotReloadScheduler   = std::function<void(double seconds, std::function<void()> work)>;
using HotReloadAction      = std::function<void()>;

class HotReloadController : public std::enable_shared_from_this<HotReloadController>
{
public:
    HotReloadController(SettingsStore &settings, HotReloadURLResolver resolveBaseURL,
                        std::shared_ptr<HotReloadTransport> transport, HotReloadScheduler schedule,
                        HotReloadAction reload);

    void sync();
    bool isRunning() const;

    bool onResponse(uint64_t connection, int status);
    bool onChunk(uint64_t connection, std::string_view chunk);
    void onClosed(uint64_t connection, const std::optional<std::string> &error);

private:
    bool shouldRun() const;
    void refresh();
    void start();
    void stop();
    void connect(uint64_t session);
    void expireResponse(uint64_t connection);
    void scheduleReconnect(uint64_t session);
    void later(double seconds, std::function<void(HotReloadController &)> work);

    SettingsStore                      &settings_;
    HotReloadURLResolver                resolveBaseURL_;
    std::shared_ptr<HotReloadTransport> transport_;
    HotReloadScheduler                  schedule_;
    HotReloadAction                     reload_;
    std::mutex                          controlMutex_;
    mutable std::mutex                  stateMutex_;
    HotReloadStream                     stream_;
    HotReloadBackoff                    backoff_;
    std::string                         url_;
    bool                                running_        = false;
    bool                                responded_      = false;
    uint64_t                            session_        = 0;
    uint64_t                            connection_     = 0;
    uint64_t                            nextConnection_ = 0;
};
}
