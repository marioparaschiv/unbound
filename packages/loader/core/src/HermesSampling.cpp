#include "HermesSampling.h"

#include <cstring>
#include <dlfcn.h>
#if __has_include(<link.h>)
#include <link.h>
#endif
#include <jsi/jsi.h>
#include <map>
#include <nlohmann/json.hpp>
#include <sstream>
#include <thread>

namespace loader::native {
namespace jsi = facebook::jsi;

namespace {
    constexpr const char *kMakeRootAPI = "_ZN8facebook6hermes17makeHermesRootAPIEv";
    constexpr jsi::UUID   kRootAPIUUID{0xb654d898, 0xdfad, 0x11ef, 0x859a, 0x325096b39f47};
    constexpr double      kSamplingHz        = 400;
    constexpr size_t      kNativeFrameHops   = 16;
    constexpr const char *kHermesLibraries[] = {"libhermesvm.so", "libhermes.so"};

#if __has_include(<link.h>)
    std::string loadedLibraryPath(const char *library)
    {
        std::pair<const char *, std::string> search{library, {}};
        dl_iterate_phdr(
            [](dl_phdr_info *info, size_t, void *data) {
                auto       *found = static_cast<std::pair<const char *, std::string> *>(data);
                std::string path  = info->dlpi_name ? info->dlpi_name : "";
                if (path.size() >= std::strlen(found->first) &&
                    path.compare(path.size() - std::strlen(found->first), std::string::npos,
                                 found->first) == 0)
                {
                    found->second = path;
                    return 1;
                }
                return 0;
            },
            &search);
        return search.second;
    }
#endif

    void *findSymbol(const char *name)
    {
        if (void *symbol = dlsym(RTLD_DEFAULT, name))
        {
            return symbol;
        }
        for (const char *library : kHermesLibraries)
        {
            void *handle = dlopen(library, RTLD_NOW | RTLD_NOLOAD);
#if __has_include(<link.h>)
            if (!handle)
            {
                std::string path = loadedLibraryPath(library);
                handle = path.empty() ? nullptr : dlopen(path.c_str(), RTLD_NOW | RTLD_NOLOAD);
            }
#endif
            if (void *symbol = handle ? dlsym(handle, name) : nullptr)
            {
                return symbol;
            }
        }
        return nullptr;
    }

    struct HermesRootAPI : jsi::ICast {
        virtual void makeHermesRuntime()                                 = 0;
        virtual void isHermesBytecode()                                  = 0;
        virtual void getBytecodeVersion()                                = 0;
        virtual void prefetchHermesBytecode()                            = 0;
        virtual void hermesBytecodeSanityCheck()                         = 0;
        virtual void setFatalHandler()                                   = 0;
        virtual void getBytecodeEpilogue()                               = 0;
        virtual void enableSamplingProfiler(double meanHzFreq)           = 0;
        virtual void disableSamplingProfiler()                           = 0;
        virtual void dumpSampledTraceToFile(const std::string &fileName) = 0;
        virtual void dumpSampledTraceToStream(std::ostream &stream)      = 0;

    protected:
        ~HermesRootAPI() = default;
    };

    HermesRootAPI *rootAPI()
    {
        using MakeRootAPI         = jsi::ICast *(*)();
        static HermesRootAPI *api = [] {
            auto        make = reinterpret_cast<MakeRootAPI>(findSymbol(kMakeRootAPI));
            jsi::ICast *root = make ? make() : nullptr;
            return root ? static_cast<HermesRootAPI *>(root->castInterface(kRootAPIUUID)) : nullptr;
        }();
        return api;
    }

    std::string frameName(const nlohmann::json &frame)
    {
        auto name = frame.find("name");
        return name != frame.end() && name->is_string() ? name->get<std::string>() : std::string();
    }

    std::string idOf(const nlohmann::json &value)
    {
        return value.is_string() ? value.get<std::string>() : value.dump();
    }

    std::string parentOf(const nlohmann::json &frame)
    {
        auto parent = frame.find("parent");
        return parent == frame.end() ? std::string() : idOf(*parent);
    }

    bool isPluginFrame(const std::string &name)
    {
        size_t open = name.find('(');
        if (open == std::string::npos || name.back() != ')')
        {
            return false;
        }
        std::string location = name.substr(open + 1, name.size() - open - 2);
        return location.rfind("unbound:", 0) != 0 && location.rfind("address at unbound", 0) != 0 &&
               location != "unbound";
    }

    bool isJavaScript(const nlohmann::json &frame)
    {
        auto category = frame.find("category");
        return category != frame.end() && category->is_string() &&
               category->get<std::string>() == "JavaScript";
    }
}

std::vector<std::string> hottestStack(const std::string &chromeTrace, size_t depth)
{
    nlohmann::json trace = nlohmann::json::parse(chromeTrace, nullptr, false);
    if (!trace.is_object() || !trace.contains("stackFrames") || !trace.contains("samples"))
    {
        return {};
    }

    const nlohmann::json         &frames = trace["stackFrames"];
    std::map<std::string, size_t> counts;
    for (const nlohmann::json &sample : trace["samples"])
    {
        auto leaf = sample.find("sf");
        if (leaf == sample.end())
        {
            continue;
        }
        std::string frame = idOf(*leaf);
        for (size_t hops = 0;
             frames.contains(frame) && !isJavaScript(frames[frame]) && hops < kNativeFrameHops;
             hops++)
        {
            frame = parentOf(frames[frame]);
        }
        if (frames.contains(frame) && isJavaScript(frames[frame]))
        {
            counts[frame]++;
        }
    }

    std::string hottest;
    size_t      best = 0;
    for (const auto &[frame, count] : counts)
    {
        if (count > best)
        {
            hottest = frame;
            best    = count;
        }
    }

    std::vector<std::string> stack;
    for (std::string current = hottest; !current.empty() && stack.size() < depth;)
    {
        if (!frames.contains(current))
        {
            break;
        }
        const nlohmann::json &frame = frames[current];
        if (isJavaScript(frame) && isPluginFrame(frameName(frame)))
        {
            stack.push_back(frameName(frame));
        }
        current = parentOf(frame);
    }
    return stack;
}

std::string describeSampledStack(const std::vector<std::string> &frames, bool insideNativeCall)
{
    if (frames.empty())
    {
        return {};
    }
    std::string text =
        (insideNativeCall ? "The call came from " : "Its JavaScript was in ") + frames.front();
    for (size_t index = 1; index < frames.size(); index++)
    {
        text += ", called from " + frames[index];
    }
    return text + ".";
}

static JavaScriptSampler gSampler;

void setJavaScriptSampler(JavaScriptSampler sampler)
{
    gSampler = std::move(sampler);
}

std::vector<std::string> sampleJavaScriptStack(std::chrono::milliseconds duration)
{
    if (gSampler)
    {
        return hottestStack(gSampler(duration));
    }

    HermesRootAPI *api = rootAPI();
    if (!api)
    {
        return {};
    }

    api->enableSamplingProfiler(kSamplingHz);
    std::this_thread::sleep_for(duration);
    std::ostringstream trace;
    api->dumpSampledTraceToStream(trace);
    api->disableSamplingProfiler();

    return hottestStack(trace.str());
}
}
