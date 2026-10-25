#include <istream>
#include <ostream>
#include <streambuf>

#import "CoreBridge.h"
#import "FileSystem.h"
#import "Logger.h"
#import "SettingsCore.h"
#import "UpdaterCore.h"

#include "HermesBytecodeHeader.h"
#include "LoaderAddons.h"
#include "LoaderLog.h"
#include "LoaderPreferences.h"
#include "LoaderPreload.h"
#include "LoaderThemes.h"
#include "LoaderToolbox.h"

static std::string toStdString(NSString *value)
{
    const char *utf8 = value.UTF8String;
    return utf8 ? std::string(utf8) : std::string();
}

static NSMutableArray *mutableArrayFromJSON(const nlohmann::json &value)
{
    std::string json   = loader::toJSON(value);
    NSData     *data   = [NSData dataWithBytes:json.data() length:json.size()];
    id          parsed = [NSJSONSerialization JSONObjectWithData:data
                                                     options:NSJSONReadingMutableContainers
                                                       error:nil];
    return [parsed isKindOfClass:[NSMutableArray class]] ? parsed : [NSMutableArray array];
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

+ (NSDictionary *)themeColors:(NSDictionary *)theme
{
    NSData *data = [NSJSONSerialization isValidJSONObject:theme]
                       ? [NSJSONSerialization dataWithJSONObject:theme options:0 error:nil]
                       : nil;
    nlohmann::json parsed =
        data ? nlohmann::json::parse(static_cast<const char *>(data.bytes),
                                     static_cast<const char *>(data.bytes) + data.length, nullptr, false)
             : nlohmann::json::object();
    loader::ThemeColors colors = loader::resolveThemeColors(parsed);

    NSMutableDictionary<NSString *, NSString *> *fallbacks = [NSMutableDictionary dictionary];
    for (const auto &[name, selector] : colors.rawFallbacks)
    {
        fallbacks[@(loader::themeColorAccessor(name).c_str())] = @(loader::themeColorAccessor(selector).c_str());
    }

    return @{@"semantic" : uiColors(colors.semantic), @"raw" : uiColors(colors.raw), @"rawFallbacks" : fallbacks};
}

+ (void)installLogging
{
    loader::setLogSink([](loader::LogLevel level, const std::string &category, const std::string &message) {
        [Logger log:iosLogLevel(level)
            category:category.c_str()
              format:@"%@", [NSString stringWithUTF8String:message.c_str()] ?: @""];
    });
}

+ (NSMutableArray *)scanPluginsIn:(NSString *)documents
{
    return mutableArrayFromJSON(loader::scanPlugins(toStdString(documents)));
}

+ (NSMutableArray *)scanThemesIn:(NSString *)documents
{
    return mutableArrayFromJSON(loader::scanThemes(toStdString(documents)));
}

+ (NSMutableArray *)scanFontsIn:(NSString *)documents
                   nameResolver:(NSString *_Nullable (^)(NSString *path))resolver
{
    loader::FontNameResolver resolveName = [resolver](const std::string &path) {
        NSString *name = resolver([NSString stringWithUTF8String:path.c_str()] ?: @"");
        return name ? toStdString(name) : std::string();
    };
    return mutableArrayFromJSON(loader::scanFonts(toStdString(documents), resolveName));
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
