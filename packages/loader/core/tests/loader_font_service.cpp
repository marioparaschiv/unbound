#include <algorithm>
#include <cassert>
#include <filesystem>
#include <fstream>
#include <map>
#include <stdexcept>
#include <string>

#include "FontFixtures.h"
#include "LoaderFontService.h"

namespace fs = std::filesystem;
using namespace loader::fonts;
using font_fixtures::FaceSpec;

static const std::string kResolve = "https://api.test/api/v1/fonts/resolve?input=";

struct Server {
    std::map<std::string, std::pair<int, std::string>> routes;
    std::vector<std::string>                           requests;

    loader::FileDownloader downloader()
    {
        return [this](const std::string &url, const std::string &destination,
                      const std::map<std::string, std::string> &,
                      const loader::DownloadPolicy &) -> std::optional<loader::DownloadResult> {
            requests.push_back(url);
            const auto route = routes.find(url);
            if (route == routes.end())
            {
                return std::nullopt;
            }
            if (route->second.first == 200)
            {
                std::ofstream(destination, std::ios::binary) << route->second.second;
            }
            return loader::DownloadResult{route->second.first, ""};
        };
    }
};

static std::string face(const std::string &postScript, uint16_t weight, bool italic = false)
{
    FaceSpec spec;
    spec.family     = "Inter";
    spec.postScript = postScript;
    spec.full       = postScript;
    spec.weight     = weight;
    spec.italic     = italic;
    return font_fixtures::font(spec);
}

static nlohmann::json file(const std::string &url, nlohmann::json weight, nlohmann::json style,
                           const char *kind = "font")
{
    return {{"url", url}, {"kind", kind}, {"weight", weight}, {"style", style}};
}

static Server interServer()
{
    Server         server;
    nlohmann::json inter                     = {{"provider", "google"},
                                                {"id", "Inter"},
                                                {"family", "Inter"},
                                                {"files",
                                                 {file("https://g.test/400.ttf", 400, "normal"),
                                                  file("https://g.test/700.ttf", 700, "normal"),
                                                  file("https://g.test/400i.ttf", 400, "italic")}}};
    server.routes[kResolve + "Inter"]        = {200, inter.dump()};
    server.routes["https://g.test/400.ttf"]  = {200, face("Inter-Regular", 400)};
    server.routes["https://g.test/700.ttf"]  = {200, face("Inter-Bold", 700)};
    server.routes["https://g.test/400i.ttf"] = {200, face("Inter-Italic", 400, true)};
    nlohmann::json pack = {{"provider", "dafont"},
                           {"id", "pack"},
                           {"family", "Pack"},
                           {"files", {file("https://d.test/pack", nullptr, nullptr, "archive")}}};
    FaceSpec       lobster;
    lobster.postScript                                                   = "Lobster-Regular";
    lobster.family                                                       = "Lobster";
    server.routes[kResolve + "https%3A%2F%2Fwww.dafont.com%2Fpack.font"] = {200, pack.dump()};
    server.routes["https://d.test/pack"]                                 = {
        200, font_fixtures::zip({{"Lobster.ttf", font_fixtures::font(lobster)}})};
    nlohmann::json broken = {{"provider", "dafont"},
                             {"id", "typo"},
                             {"family", "Typo"},
                             {"files", {file("https://d.test/typo", nullptr, nullptr, "archive")}}};
    server.routes[kResolve + "typo"]     = {200, broken.dump()};
    server.routes["https://d.test/typo"] = {200, "<!DOCTYPE html><title>dafont</title>"};
    server.routes[kResolve + "Nothing"]  = {404, ""};
    return server;
}

static void installsChosenVariants(FontService &service, Server &server)
{
    // JS numbers cross the bridge as doubles.
    const nlohmann::json result =
        service.install("Inter", {{{"weight", 400.0}, {"style", "normal"}},
                                  {{"weight", 700}, {"style", "normal"}}});
    assert(result["installed"].size() == 2 && result["errors"].empty());
    assert(std::count(server.requests.begin(), server.requests.end(), "https://g.test/400i.ttf") ==
           0);
    const nlohmann::json listed = service.list();
    assert(listed["fonts"].size() == 2);
    assert(listed["fonts"][0]["source"] ==
           nlohmann::json({{"google", "Inter"}, {"weight", 400}, {"style", "normal"}}));
    assert(fs::exists(listed["fonts"][0]["path"].get<std::string>()));
}

static void refusesPagesAndUnknownFonts(FontService &service)
{
    auto rejects = [&](const std::string &input, const std::string &reason) {
        try
        {
            service.install(input, nullptr);
        }
        catch (const std::runtime_error &error)
        {
            return std::string(error.what()).find(reason) != std::string::npos;
        }
        return false;
    };
    assert(rejects("typo", "not a font or a zip"));
    assert(rejects("Nothing", "No font was found"));
    assert(rejects("Offline", "could not be reached"));
    assert(service.list()["fonts"].size() == 2);
}

static void appliesPresetsLazily(FontService &service, Server &server)
{
    service.setTargets({{"PRIMARY_NORMAL", "ggsans-Normal"},
                        {"PRIMARY_BOLD", "ggsans-Bold"},
                        {"PRIMARY_NORMAL_ITALIC", "ggsans-NormalItalic"},
                        {"DISPLAY_NORMAL", "ggsans-Display"}},
                       {{"api", "https://api.test/"}});
    service.setOverride("PRIMARY", std::string("Inter-Regular"));
    assert(service.list()["overrides"]["ggsans-Bold"] == "Inter-Bold");
    // No italic face installed: the nearest upright one stands in.
    assert(service.list()["overrides"]["ggsans-NormalItalic"] == "Inter-Regular");

    const nlohmann::json snapshot = service.savePreset({{"name", "Snapshot"}});
    assert(snapshot["overrides"]["ggsans-Bold"] ==
           nlohmann::json({{"google", "Inter"}, {"weight", 700}, {"style", "normal"}}));

    const nlohmann::json pasted = service.savePreset(
        {{"name", "Pasted"},
         {"overrides",
          {{"ggsans-Normal", {{"google", "Inter"}, {"weight", 400.0}, {"style", "normal"}}},
           {"ggsans-NormalItalic", {{"google", "Inter"}, {"weight", 400}, {"style", "italic"}}},
           {"ggsans-Bold", {{"google", "Inter"}, {"weight", 900}, {"style", "normal"}}},
           {"ggsans-Display", {{"dafont", "pack"}}},
           {"ggsans-Gone", {{"google", "Inter"}}}}}});

    server.requests.clear();
    const nlohmann::json result = service.applyPreset(pasted["id"]);
    assert(result["skipped"] == nlohmann::json::array({"ggsans-Gone"}));
    // Weight 900 does not exist: that face keeps Discord's font.
    assert(result["unavailable"] == nlohmann::json::array({"ggsans-Bold"}));
    assert(result["applied"].size() == 3);
    const nlohmann::json overrides = service.list()["overrides"];
    assert(overrides["ggsans-NormalItalic"] == "Inter-Italic");
    assert(overrides["ggsans-Display"] == "Lobster-Regular");
    assert(!overrides.contains("ggsans-Bold"));
    assert(std::count(server.requests.begin(), server.requests.end(), "https://g.test/700.ttf") ==
           0);

    service.removePreset(pasted["id"]);
    assert(service.listPresets().size() == 1);
}

static void validatesPresets(FontService &service)
{
    auto rejects = [&](const nlohmann::json &preset) {
        try
        {
            service.savePreset(preset);
        }
        catch (const std::runtime_error &)
        {
            return true;
        }
        return false;
    };
    assert(rejects(nlohmann::json::array()));
    assert(rejects({{"name", ""}, {"overrides", nlohmann::json::object()}}));
    assert(
        rejects({{"name", "x"}, {"overrides", {{"a", {{"url", "http://insecure.test/a.ttf"}}}}}}));
    assert(rejects({{"name", "x"}, {"overrides", {{"a", {{"google", "A"}, {"dafont", "b"}}}}}}));
    assert(rejects({{"name", "x"}, {"overrides", {{"a", {{"google", "A"}, {"weight", 5000}}}}}}));
    assert(rejects({{"name", "x"}, {"overrides", {{"a", {{"google", "A"}, {"weight", 400.5}}}}}}));
    assert(rejects({{"name", "x"}, {"overrides", {{"a", {{"nope", "A"}}}}}}));
}

int main()
{
    const fs::path root = fs::temp_directory_path() / "unbound-font-service";
    fs::remove_all(root);
    Server      server = interServer();
    FontService service(root.string(), server.downloader());
    service.setApiOrigin("https://api.test");
    service.store().open(nlohmann::json::object());

    installsChosenVariants(service, server);
    refusesPagesAndUnknownFonts(service);
    appliesPresetsLazily(service, server);
    validatesPresets(service);
    assert(percentEncode("a b/é") == "a%20b%2F%C3%A9");
    fs::remove_all(root);
    return 0;
}
