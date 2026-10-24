#include <istream>
#include <ostream>
#include <streambuf>

#import "CoreBridge.h"
#import "Logger.h"

#include "LoaderAddons.h"
#include "LoaderLog.h"
#include "LoaderPreload.h"
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

static std::vector<std::pair<std::string, std::string>> pairsFromArray(NSArray<NSArray<NSString *> *> *rows)
{
    std::vector<std::pair<std::string, std::string>> pairs;

    for (NSArray<NSString *> *row in rows)
    {
        if (row.count == 2)
        {
            pairs.emplace_back(toStdString(row[0]), toStdString(row[1]));
        }
    }

    return pairs;
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

+ (BOOL)wipeAddonsNamed:(NSString *)kind in:(NSString *)documents
{
    for (auto candidate : {loader::toolbox::AddonKind::Plugins, loader::toolbox::AddonKind::Themes,
                           loader::toolbox::AddonKind::Icons, loader::toolbox::AddonKind::Fonts})
    {
        if ([kind caseInsensitiveCompare:@(loader::toolbox::addonDirectoryName(candidate))] == NSOrderedSame)
        {
            return loader::toolbox::wipeAddons(toStdString(documents), candidate);
        }
    }

    return NO;
}

+ (BOOL)factoryResetIn:(NSString *)documents
{
    return loader::toolbox::factoryReset(toStdString(documents));
}

+ (NSString *)issueURLForPlatform:(NSString *)platform
                      environment:(NSArray<NSArray<NSString *> *> *)environment
                      attachments:(NSArray<NSArray<NSString *> *> *)attachments
{
    loader::toolbox::IssueReport report;
    report.platform    = toStdString(platform);
    report.environment = pairsFromArray(environment);
    report.attachments = pairsFromArray(attachments);

    return [NSString stringWithUTF8String:loader::toolbox::issueURL(report).c_str()] ?: @"";
}

@end
