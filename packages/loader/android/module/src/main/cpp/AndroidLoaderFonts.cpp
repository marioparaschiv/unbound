#include "AndroidLoader.h"
#include "JniEnvironment.h"
#include "LoaderFonts.h"
#include "LoaderJSON.h"
#include "LoaderPreferences.h"
#include "UnboundNativeFonts.h"

// The font half of AndroidLoader: the font store, the catalog plugins list, and the lookups the
// Kotlin typeface hooks make.
namespace unbound::android {
static constexpr const char *kAssetFontPrefix = "asset:";

void AndroidLoader::openFonts()
{
    fonts_ = std::make_shared<loader::fonts::FontService>(
        configuration_.documents,
        [weak = weak_from_this()](const std::string &url, const std::string &destination,
                                  const std::map<std::string, std::string> &headers,
                                  const loader::DownloadPolicy             &policy) {
            auto self = std::static_pointer_cast<AndroidLoader>(weak.lock());
            return self ? self->download(url, destination, headers, policy) : std::nullopt;
        });
    fonts_->store().open(loader::preferences::fontOverrides(settings_));
    // Kotlin drops its cached typefaces, so text laid out after the change, such as after the
    // restart the client offers, uses the new fonts.
    fonts_->store().setOnChange([callbacks = callbacks_] {
        if (JNIEnv *env = currentEnvironment())
        {
            env->CallStaticVoidMethod(callbacks.bridgeClass, callbacks.fontsChanged);
            clearPendingException(env);
        }
    });
}

static std::vector<std::string> callStringArray(JNIEnv *env, jclass type, jmethodID method)
{
    std::vector<std::string> values;
    auto array = static_cast<jobjectArray>(env->CallStaticObjectMethod(type, method));
    if (clearPendingException(env) || !array)
    {
        return values;
    }
    jsize count = env->GetArrayLength(array);
    for (jsize index = 0; index < count; index++)
    {
        auto value = static_cast<jstring>(env->GetObjectArrayElement(array, index));
        values.push_back(toStdString(env, value));
        env->DeleteLocalRef(value);
    }
    env->DeleteLocalRef(array);
    return values;
}

nlohmann::json AndroidLoader::appFonts()
{
    nlohmann::json fonts = nlohmann::json::array();
    JNIEnv        *env   = currentEnvironment();
    if (!env)
    {
        return fonts;
    }

    for (const std::string &asset :
         callStringArray(env, callbacks_.bridgeClass, callbacks_.appFonts))
    {
        jstring javaPath = toJavaString(env, asset);
        auto    bytes    = static_cast<jbyteArray>(
            env->CallStaticObjectMethod(callbacks_.bridgeClass, callbacks_.appFontBytes, javaPath));
        env->DeleteLocalRef(javaPath);
        if (clearPendingException(env) || !bytes)
        {
            continue;
        }

        std::string data(static_cast<size_t>(env->GetArrayLength(bytes)), '\0');
        env->GetByteArrayRegion(bytes, 0, static_cast<jsize>(data.size()),
                                reinterpret_cast<jbyte *>(data.data()));
        env->DeleteLocalRef(bytes);

        const size_t      slash = asset.find_last_of('/');
        const size_t      dot   = asset.find_last_of('.');
        const std::string stem =
            asset.substr(slash + 1, dot == std::string::npos ? std::string::npos : dot - slash - 1);
        fonts.push_back(
            loader::fontEntryFromData(data, std::string(kAssetFontPrefix) + asset, "app", stem));
    }
    return fonts;
}

const nlohmann::json &AndroidLoader::systemFonts()
{
    std::lock_guard<std::mutex> lock(systemFontsMutex_);
    if (systemFonts_)
    {
        return *systemFonts_;
    }

    nlohmann::json fonts = appFonts();
    if (JNIEnv *env = currentEnvironment())
    {
        for (nlohmann::json &font : loader::systemFontsFromFiles(
                 callStringArray(env, callbacks_.bridgeClass, callbacks_.availableFonts), "system"))
        {
            fonts.push_back(std::move(font));
        }
    }

    systemFonts_ = loader::fontCatalog(nlohmann::json::array(), fonts);
    return *systemFonts_;
}

nlohmann::json AndroidLoader::fontCatalog()
{
    return loader::fontCatalog(fonts_->catalogEntries(), systemFonts());
}

std::string AndroidLoader::resolveFont(const std::string &family)
{
    const auto target = fonts_ ? fonts_->store().overrideTarget(family) : std::nullopt;
    return target ? loader::toJSON(*target) : "{}";
}
}
