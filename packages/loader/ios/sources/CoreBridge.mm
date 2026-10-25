#include <istream>
#include <ostream>
#include <streambuf>

#import "CoreConversions.h"
#import "AddonsCore.h"
#import "CoreBridge.h"
#import "FileSystem.h"
#import "Logger.h"
#import "SettingsCore.h"
#import "UpdaterCore.h"

#include "HermesBytecodeHeader.h"
#include "LoaderAddons.h"
#include "LoaderFonts.h"
#include "LoaderLog.h"
#include "LoaderPreferences.h"
#include "LoaderPreload.h"
#include "LoaderThemes.h"
#include "LoaderToolbox.h"

using unbound::ios::objectFromJSON;
using unbound::ios::toStdString;

static NSArray *arrayFromJSON(const nlohmann::json &value)
{
    id converted = objectFromJSON(value);
    return [converted isKindOfClass:[NSArray class]] ? converted : @[];
}

loader::AddonState &UnboundAddonState()
{
    static loader::AddonState state;
    return state;
}

static LogLevel iosLogLevel(loader::LogLevel level)
{
    switch (level)
    {
        case loader::LogLevel::Debug:
            return LogLevelDebug;
        case loader::LogLevel::Info:
            return LogLevelInfo;
        case loader::LogLevel::Warning:
            return LogLevelNotice;
        case loader::LogLevel::Error:
            return LogLevelError;
    }
    return LogLevelInfo;
}

@implementation CoreBridge

+ (NSString *)documentsName
{
    return @(loader::preferences::kDocumentsName);
}

+ (uint32_t)mainBundleBytecodeVersion
{
    NSString *path    = [NSBundle.mainBundle.bundlePath stringByAppendingPathComponent:@"main.jsbundle"];
    uint32_t  version = loader::hermesBytecodeVersionOfFile(toStdString(path));

    if (version == 0)
    {
        [Logger error:LOG_CATEGORY_UTILITIES format:@"%@ is not a readable Hermes bytecode bundle", path];
    }
    return version;
}

static UIColor *uiColor(const loader::RGBAColor &color)
{
    return [UIColor colorWithRed:color.red green:color.green blue:color.blue alpha:color.alpha];
}

static NSDictionary<NSString *, UIColor *> *uiColors(const std::map<std::string, loader::RGBAColor> &colors)
{
    NSMutableDictionary<NSString *, UIColor *> *result = [NSMutableDictionary dictionaryWithCapacity:colors.size()];
    for (const auto &[name, color] : colors)
    {
        result[@(loader::themeColorAccessor(name).c_str())] = uiColor(color);
    }
    return result;
}

+ (UIColor *)colorFromString:(NSString *)value
{
    std::optional<loader::RGBAColor> color = loader::parseColor(toStdString(value));
    return color ? uiColor(*color) : nil;
}

+ (NSDictionary *)themeColorsForId:(NSString *)themeId
{
    std::optional<nlohmann::json> theme = UnboundAddonState().theme(toStdString(themeId));
    if (!theme)
    {
        return nil;
    }

    loader::ThemeColors colors = loader::resolveThemeColors(*theme);

    NSMutableDictionary<NSString *, NSString *> *fallbacks = [NSMutableDictionary dictionary];
    for (const auto &[name, selector] : colors.rawFallbacks)
    {
        fallbacks[@(loader::themeColorAccessor(name).c_str())] = @(loader::themeColorAccessor(selector).c_str());
    }

    return @{@"semantic" : uiColors(colors.semantic), @"raw" : uiColors(colors.raw), @"rawFallbacks" : fallbacks};
}

+ (BOOL)hasTheme:(NSString *)themeId
{
    return UnboundAddonState().theme(toStdString(themeId)).has_value();
}

+ (void)installLogging
{
    loader::setLogSink([](loader::LogLevel level, const std::string &category, const std::string &message) {
        [Logger log:iosLogLevel(level)
            category:category.c_str()
              format:@"%@", [NSString stringWithUTF8String:message.c_str()] ?: @""];
    });
}

+ (void)scanAddons
{
    UnboundAddonState().scan(toStdString(FileSystem.documents));
}

+ (NSArray *)themes
{
    return arrayFromJSON(UnboundAddonState().themes());
}

+ (NSDictionary<NSString *, NSDictionary *> *)fontOverrideTargets:(NSArray<NSString *> *)systemFonts
{
    nlohmann::json system = nlohmann::json::array();
    for (NSString *family in systemFonts)
    {
        system.push_back(toStdString(family));
    }

    nlohmann::json custom    = UnboundAddonState().fonts();
    nlohmann::json overrides = loader::preferences::fontOverrides(UnboundSettingsStore());
    nlohmann::json targets   = nlohmann::json::object();
    for (const auto &[key, value] : overrides.items())
    {
        if (!value.is_string() || value.get<std::string>().empty())
        {
            continue;
        }
        const std::string name = value.get<std::string>();
        const auto        font = loader::resolveFontTarget(custom, system, name);
        if (!font)
        {
            targets[key] = {{"name", name}, {"error", loader::fontUnavailableMessage(key, name)}};
            continue;
        }
        targets[key] = {{"name", font->name}};
        if (font->path)
        {
            targets[key]["path"] = *font->path;
        }
    }

    id converted = objectFromJSON(targets);
    return [converted isKindOfClass:[NSDictionary class]] ? converted : @{};
}

+ (NSArray<NSDictionary *> *)fonts
{
    return arrayFromJSON(UnboundAddonState().fonts());
}

+ (NSString *)toolbox:(NSString *)action argument:(NSString *)argument
{
    loader::toolbox::ToolboxContext context{UnboundSettingsStore(),
                                            UnboundBundleUpdater(),
                                            toStdString(FileSystem.documents),
                                            "iOS",
                                            [] { return UnboundUpdateURL(); },
                                            [] { return [CoreBridge mainBundleBytecodeVersion]; }};
    std::string result = loader::toolbox::perform(context, toStdString(action), toStdString(argument));
    return [NSString stringWithUTF8String:result.c_str()] ?: @"";
}

+ (NSString *)preference:(NSString *)action argument:(NSString *)argument
{
    std::string result =
        loader::preferences::perform(UnboundSettingsStore(), toStdString(action), toStdString(argument));
    return [NSString stringWithUTF8String:result.c_str()] ?: @"";
}

+ (BOOL)preferenceEnabled:(NSString *)action
{
    return [[self preference:action argument:@""] isEqualToString:@"true"];
}

+ (BOOL)toolboxSucceeded:(NSString *)action argument:(NSString *)argument
{
    return [[self toolbox:action argument:argument] isEqualToString:@"true"];
}

+ (NSString *)toolboxMessage:(NSString *)key
{
    return [self toolbox:@"message" argument:key];
}

@end
