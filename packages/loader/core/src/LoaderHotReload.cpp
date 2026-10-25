#include "LoaderHotReload.h"

#include <algorithm>

#include <nlohmann/json.hpp>

#include "LoaderLog.h"
#include "LoaderPreferences.h"

namespace loader
{
    static constexpr std::string_view kDevServerProbePath = "manifest.json";
    static constexpr std::string_view kHotReloadPath      = "/__hot";

    static std::string_view trimmed(std::string_view value)
    {
        const auto isSpace = [](char character) {
            return character == ' ' || character == '\t' || character == '\r';
        };
        while (!value.empty() && isSpace(value.front()))
        {
            value.remove_prefix(1);
        }
        while (!value.empty() && isSpace(value.back()))
        {
            value.remove_suffix(1);
        }
        return value;
    }

    std::optional<std::string> resolveUpdateURL(const UpdaterSettings &settings,
                                                const std::optional<std::string> &devServerHost,
                                                const ReachabilityProbe &isServing)
    {
        std::string configured = settings.getString("loader.update.url", "");
        if (!configured.empty())
        {
            return configured;
        }

        if (!devServerHost || devServerHost->empty())
        {
            return std::nullopt;
        }

        std::string base = "http://" + *devServerHost + ":" + std::to_string(kDevServerPort) + "/";
        if (!isServing || !isServing(base + std::string(kDevServerProbePath), kDevServerProbeTimeoutSeconds))
        {
            log(LogLevel::Info, "updater",
                "Dev server: " + base + " is not reachable; using the default update URL.");
            return std::nullopt;
        }

        log(LogLevel::Info, "updater", "Dev server: using " + base + ".");
        return base;
    }

    std::optional<std::string> hotReloadURL(const std::string &base)
    {
        size_t schemeEnd = base.find("://");
        if (schemeEnd == std::string::npos || schemeEnd == 0)
        {
            return std::nullopt;
        }

        size_t authorityStart = schemeEnd + 3;
        size_t authorityEnd   = base.find_first_of("/?#", authorityStart);
        std::string authority = base.substr(authorityStart, authorityEnd == std::string::npos
                                                                ? std::string::npos
                                                                : authorityEnd - authorityStart);
        size_t credentials = authority.rfind('@');
        if (credentials != std::string::npos)
        {
            authority.erase(0, credentials + 1);
        }
        if (authority.empty() || authority.front() == ':')
        {
            return std::nullopt;
        }

        return base.substr(0, authorityStart) + authority + std::string(kHotReloadPath);
    }

    std::string normalizedEtag(std::string_view etag)
    {
        if (etag.substr(0, 2) == "W/")
        {
            etag.remove_prefix(2);
        }
        while (!etag.empty() && etag.front() == '"')
        {
            etag.remove_prefix(1);
        }
        while (!etag.empty() && etag.back() == '"')
        {
            etag.remove_suffix(1);
        }
        return std::string(etag);
    }

    std::optional<std::string> hotReloadEtag(std::string_view event)
    {
        std::string_view name;
        std::string_view data;

        while (!event.empty())
        {
            size_t           end  = event.find('\n');
            std::string_view line = event.substr(0, end);
            event.remove_prefix(end == std::string_view::npos ? event.size() : end + 1);

            if (line.substr(0, 6) == "event:")
            {
                name = trimmed(line.substr(6));
            }
            else if (line.substr(0, 5) == "data:")
            {
                data = trimmed(line.substr(5));
            }
        }

        if (name != "reload" || data.empty())
        {
            return std::nullopt;
        }

        nlohmann::json payload = nlohmann::json::parse(data, nullptr, false);
        if (!payload.is_object() || !payload.contains("etag") || !payload["etag"].is_string())
        {
            return std::nullopt;
        }

        std::string etag = payload["etag"].get<std::string>();
        return etag.empty() ? std::nullopt : std::optional<std::string>(etag);
    }

    bool hotReloadEventRequiresReload(const UpdaterSettings &settings, std::string_view event)
    {
        std::optional<std::string> incoming = hotReloadEtag(event);
        if (!incoming)
        {
            return false;
        }

        std::string stored = settings.getString("loader.update.etag", "");
        if (!stored.empty() && normalizedEtag(stored) == normalizedEtag(*incoming))
        {
            log(LogLevel::Info, "updater", "Hot-reload: etag unchanged (" + *incoming + "); skipping reload.");
            return false;
        }

        log(LogLevel::Info, "updater",
            "Hot-reload: etag mismatch (stored " + (stored.empty() ? std::string("<none>") : stored) +
                ", incoming " + *incoming + ") -> reloading.");
        return true;
    }

    double HotReloadBackoff::next()
    {
        double current = delay_;
        delay_         = std::min(delay_ * 2.0, kHotReloadMaximumDelaySeconds);
        return current;
    }

    void HotReloadBackoff::reset()
    {
        delay_ = kHotReloadMinimumDelaySeconds;
    }

    HotReloadStream::HotReloadStream(UpdaterSettings settings) : settings_(std::move(settings)) {}

    bool HotReloadStream::feed(std::string_view chunk)
    {
        buffer_.append(chunk);
        buffer_.erase(std::remove(buffer_.begin(), buffer_.end(), '\r'), buffer_.end());

        bool reload = false;
        size_t separator;
        while ((separator = buffer_.find("\n\n")) != std::string::npos)
        {
            std::string event = buffer_.substr(0, separator);
            buffer_.erase(0, separator + 2);
            reload = hotReloadEventRequiresReload(settings_, event) || reload;
        }
        return reload;
    }

    void HotReloadStream::reset()
    {
        buffer_.clear();
    }

    static void logHotReload(const std::string &message)
    {
        log(LogLevel::Info, "updater", "Hot-reload: " + message);
    }

    HotReloadController::HotReloadController(SettingsStore &settings, HotReloadURLResolver resolveBaseURL,
                                             std::shared_ptr<HotReloadTransport> transport,
                                             HotReloadScheduler schedule, HotReloadAction reload)
        : settings_(settings), resolveBaseURL_(std::move(resolveBaseURL)), transport_(std::move(transport)),
          schedule_(std::move(schedule)), reload_(std::move(reload)), stream_(updaterSettings(settings))
    {
    }

    void HotReloadController::sync()
    {
        later(0, [](HotReloadController &controller) { controller.refresh(); });
    }

    bool HotReloadController::isRunning() const
    {
        std::lock_guard<std::mutex> lock(stateMutex_);
        return running_;
    }

    bool HotReloadController::shouldRun() const
    {
        return preferences::loaderEnabled(settings_) && preferences::hotReloadEnabled(settings_);
    }

    void HotReloadController::refresh()
    {
        std::lock_guard<std::mutex> control(controlMutex_);
        bool                        enabled = shouldRun();
        bool                        running = isRunning();
        if (enabled && !running)
        {
            start();
        }
        else if (!enabled && running)
        {
            stop();
        }
    }

    void HotReloadController::start()
    {
        std::optional<std::string> base = resolveBaseURL_ ? resolveBaseURL_() : std::nullopt;
        std::optional<std::string> url  = base ? hotReloadURL(*base) : std::nullopt;
        if (!url)
        {
            logHotReload("no dev server origin resolved; live reload not started.");
            return;
        }

        uint64_t session;
        {
            std::lock_guard<std::mutex> lock(stateMutex_);
            url_     = *url;
            running_ = true;
            session  = ++session_;
            backoff_.reset();
        }

        logHotReload("enabled.");
        connect(session);
    }

    void HotReloadController::stop()
    {
        {
            std::lock_guard<std::mutex> lock(stateMutex_);
            running_    = false;
            connection_ = 0;
            session_++;
            stream_.reset();
        }

        transport_->cancel();
        logHotReload("disabled; stream stopped.");
    }

    void HotReloadController::connect(uint64_t session)
    {
        HotReloadRequest request;
        {
            std::lock_guard<std::mutex> lock(stateMutex_);
            if (!running_ || session_ != session)
            {
                return;
            }

            connection_ = ++nextConnection_;
            responded_  = false;
            stream_.reset();
            request.connection = connection_;
            request.url        = url_;
        }

        request.headers = {{"Accept", "text/event-stream"}, {"Cache-Control", "no-cache"}};
        logHotReload("connecting SSE to " + request.url);
        transport_->open(request);

        uint64_t connection = request.connection;
        later(request.connectTimeoutSeconds,
              [connection](HotReloadController &controller) { controller.expireResponse(connection); });
    }

    void HotReloadController::expireResponse(uint64_t connection)
    {
        std::lock_guard<std::mutex> control(controlMutex_);
        uint64_t                    session;
        {
            std::lock_guard<std::mutex> lock(stateMutex_);
            if (connection_ != connection || responded_)
            {
                return;
            }
            connection_ = 0;
            session     = session_;
        }

        transport_->cancel();
        logHotReload("SSE disconnected (timed out).");
        scheduleReconnect(session);
    }

    void HotReloadController::scheduleReconnect(uint64_t session)
    {
        double delay;
        {
            std::lock_guard<std::mutex> lock(stateMutex_);
            if (!running_ || session_ != session)
            {
                return;
            }
            delay = backoff_.next();
        }

        logHotReload("reconnecting in " + std::to_string(static_cast<int>(delay)) + "s.");
        later(delay, [session](HotReloadController &controller) {
            std::lock_guard<std::mutex> control(controller.controlMutex_);
            controller.connect(session);
        });
    }

    bool HotReloadController::onResponse(uint64_t connection, int status)
    {
        bool     accepted = status == 200;
        uint64_t session;
        {
            std::lock_guard<std::mutex> lock(stateMutex_);
            if (connection == 0 || connection_ != connection || responded_)
            {
                return false;
            }
            if (accepted)
            {
                responded_ = true;
                backoff_.reset();
            }
            else
            {
                connection_ = 0;
            }
            session = session_;
        }

        if (accepted)
        {
            logHotReload("SSE connected.");
            return true;
        }

        logHotReload("SSE disconnected (HTTP " + std::to_string(status) + ").");
        scheduleReconnect(session);
        return false;
    }

    bool HotReloadController::onChunk(uint64_t connection, std::string_view chunk)
    {
        bool reload;
        {
            std::lock_guard<std::mutex> lock(stateMutex_);
            if (connection == 0 || connection_ != connection || !responded_)
            {
                return false;
            }
            reload = stream_.feed(chunk);
        }

        if (reload && reload_)
        {
            reload_();
        }
        return true;
    }

    void HotReloadController::onClosed(uint64_t connection, const std::optional<std::string> &error)
    {
        uint64_t session;
        {
            std::lock_guard<std::mutex> lock(stateMutex_);
            if (connection == 0 || connection_ != connection)
            {
                return;
            }
            connection_ = 0;
            session     = session_;
        }

        logHotReload(error ? "SSE disconnected (" + *error + ")." : std::string("SSE stream closed."));
        scheduleReconnect(session);
    }

    void HotReloadController::later(double seconds, std::function<void(HotReloadController &)> work)
    {
        std::weak_ptr<HotReloadController> weak = weak_from_this();
        schedule_(seconds, [weak, work = std::move(work)]() {
            if (auto controller = weak.lock())
            {
                work(*controller);
            }
        });
    }
}
