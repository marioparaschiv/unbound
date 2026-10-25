#include <cassert>
#include <map>
#include <string>

#include "LoaderHotReload.h"

static loader::UpdaterSettings memorySettings(std::map<std::string, std::string> &values)
{
    loader::UpdaterSettings settings;
    settings.getString = [&values](const std::string &key, const std::string &fallback) {
        auto found = values.find(key);
        return found == values.end() ? fallback : found->second;
    };
    settings.getBoolean = [](const std::string &, bool fallback) {
        return fallback;
    };
    settings.setString = [&values](const std::string &key, const std::string &value) {
        values[key] = value;
    };
    return settings;
}

int main()
{
    std::map<std::string, std::string> values;
    auto                               settings = memorySettings(values);

    std::string probed;
    auto        reachable = [&probed](const std::string &url, double timeout) {
        probed = url;
        assert(timeout == loader::kDevServerProbeTimeoutSeconds);
        return true;
    };
    auto unreachable = [](const std::string &, double) {
        return false;
    };

    assert(!loader::resolveUpdateURL(settings, std::nullopt, reachable));
    assert(loader::resolveUpdateURL(settings, std::string("10.0.2.2"), reachable) ==
           std::optional<std::string>("http://10.0.2.2:3000/"));
    assert(probed == "http://10.0.2.2:3000/manifest.json");
    assert(!loader::resolveUpdateURL(settings, std::string("10.0.2.2"), unreachable));
    values["loader.update.url"] = "https://example.com/unbound.bundle";
    assert(loader::resolveUpdateURL(settings, std::nullopt, unreachable) ==
           std::optional<std::string>("https://example.com/unbound.bundle"));
    values.erase("loader.update.url");

    assert(loader::hotReloadURL("http://10.0.2.2:3000/unbound.bundle") ==
           std::optional<std::string>("http://10.0.2.2:3000/__hot"));
    assert(loader::hotReloadURL("https://user@example.com?x=1") ==
           std::optional<std::string>("https://example.com/__hot"));
    assert(!loader::hotReloadURL("not a url"));
    assert(!loader::hotReloadURL("http:///path"));

    assert(loader::normalizedEtag("W/\"abc\"") == "abc");
    assert(loader::normalizedEtag("\"abc\"") == "abc");

    assert(loader::hotReloadEtag("event: reload\ndata: {\"etag\":\"W/\\\"1\\\"\"}") ==
           std::optional<std::string>("W/\"1\""));
    assert(!loader::hotReloadEtag("event: ping\ndata: {\"etag\":\"1\"}"));
    assert(!loader::hotReloadEtag("event: reload\ndata: not json"));
    assert(!loader::hotReloadEtag(": comment"));

    values["loader.update.etag"] = "\"1\"";
    loader::HotReloadStream stream(settings);
    assert(!stream.feed("event: reload\r\ndata: {\"etag\":\"W/\\\"1\\\"\"}\r\n"));
    assert(!stream.feed("\r\n"));
    assert(!stream.feed("event: reload\ndata: {\"et"));
    assert(stream.feed("ag\":\"2\"}\n\n"));
    stream.feed("event: reload\ndata: {\"etag\":\"3\"}");
    stream.reset();
    assert(!stream.feed("\n\n"));

    loader::HotReloadBackoff backoff;
    assert(backoff.next() == 1.0);
    assert(backoff.next() == 2.0);
    for (int attempt = 0; attempt < 10; attempt++)
    {
        backoff.next();
    }
    assert(backoff.next() == loader::kHotReloadMaximumDelaySeconds);
    backoff.reset();
    assert(backoff.next() == 1.0);
    return 0;
}
