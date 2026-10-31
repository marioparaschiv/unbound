#import "CoreBridge.h"

#import <CoreText/CoreText.h>
#include <istream>
#include <ostream>
#include <streambuf>

#import "AddonsCore.h"
#import "CoreConversions.h"
#import "FileSystem.h"
#include "HermesBytecodeHeader.h"
#include "LoaderAddons.h"
#include "LoaderDevOverlay.h"
#include "LoaderDiagnostics.h"
#include "LoaderFonts.h"
#include "LoaderLog.h"
#include "LoaderLogFile.h"
#include "LoaderPreferences.h"
#include "LoaderPreload.h"
#include "LoaderThemes.h"
#include "LoaderToolbox.h"
#import "Logger.h"
#import "SettingsCore.h"
#import "Unbound.h"
#import "UpdaterCore.h"

using unbound::ios::jsonFromObject;
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
            return LogLevelWarning;
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
    NSString *path =
        [NSBundle.mainBundle.bundlePath stringByAppendingPathComponent:@"main.jsbundle"];
    uint32_t version = loader::hermesBytecodeVersionOfFile(toStdString(path));

    if (version == 0)
    {
        [Logger error:LOG_CATEGORY_UTILITIES
               format:@"%@ is not a readable Hermes bytecode bundle", path];
    }
    return version;
}

static UIColor *uiColor(const loader::RGBAColor &color)
{
    return [UIColor colorWithRed:color.red green:color.green blue:color.blue alpha:color.alpha];
}

static NSDictionary<NSString *, UIColor *> *
uiColors(const std::map<std::string, loader::RGBAColor> &colors)
{
    NSMutableDictionary<NSString *, UIColor *> *result =
        [NSMutableDictionary dictionaryWithCapacity:colors.size()];
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

+ (BOOL)isDarkColor:(UIColor *)color
{
    CGFloat red = 0, green = 0, blue = 0, alpha = 0;
    [color getRed:&red green:&green blue:&blue alpha:&alpha];
    return loader::isDarkColor({red, green, blue, alpha});
}

static std::string fontAttribute(CTFontDescriptorRef descriptor, CFStringRef attribute)
{
    NSString *value = CFBridgingRelease(CTFontDescriptorCopyAttribute(descriptor, attribute));
    return [value isKindOfClass:[NSString class]] ? toStdString(value) : std::string();
}

static nlohmann::json platformFontEntry(NSString *postScriptName, NSString *appPath)
{
    CTFontDescriptorRef descriptor =
        CTFontDescriptorCreateWithNameAndSize((__bridge CFStringRef) postScriptName, 0);
    nlohmann::json entry = {{"name", toStdString(postScriptName)}, {"source", "system"}};
    if (!descriptor)
    {
        entry["displayName"] = entry["name"];
        return entry;
    }

    const std::string display = fontAttribute(descriptor, kCTFontDisplayNameAttribute);
    const std::string family  = fontAttribute(descriptor, kCTFontFamilyNameAttribute);
    const std::string style   = fontAttribute(descriptor, kCTFontStyleNameAttribute);
    NSURL *url = CFBridgingRelease(CTFontDescriptorCopyAttribute(descriptor, kCTFontURLAttribute));
    CFRelease(descriptor);

    entry["displayName"] = display.empty() ? entry["name"] : nlohmann::json(display);
    if (!family.empty())
    {
        entry["family"] = family;
    }
    if (!style.empty())
    {
        entry["style"] = style;
    }
    if ([url isKindOfClass:[NSURL class]] && [url.path hasPrefix:appPath])
    {
        entry["source"] = "app";
    }
    return entry;
}

const nlohmann::json &UnboundPlatformFonts()
{
    static nlohmann::json  fonts;
    static dispatch_once_t onceToken;
    dispatch_once(&onceToken, ^{
        NSArray       *names   = CFBridgingRelease(CTFontManagerCopyAvailablePostScriptNames());
        NSString      *appPath = NSBundle.mainBundle.bundlePath;
        nlohmann::json entries = nlohmann::json::array();
        for (NSString *name in [names sortedArrayUsingSelector:@selector(compare:)])
        {
            entries.push_back(platformFontEntry(name, appPath));
        }
        fonts = loader::fontCatalog(nlohmann::json::array(), entries);
    });
    return fonts;
}

nlohmann::json UnboundFontCatalog()
{
    return loader::fontCatalog(UnboundAddonState().fonts(), UnboundPlatformFonts());
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
        fallbacks[@(loader::themeColorAccessor(name).c_str())] =
            @(loader::themeColorAccessor(selector).c_str());
    }

    return @{
        @"semantic" : uiColors(colors.semantic),
        @"raw" : uiColors(colors.raw),
        @"rawFallbacks" : fallbacks
    };
}

+ (BOOL)hasTheme:(NSString *)themeId
{
    return UnboundAddonState().theme(toStdString(themeId)).has_value();
}

+ (void)installLogging
{
    loader::setLogSink(
        [](loader::LogLevel level, const std::string &category, const std::string &message) {
            [Logger log:iosLogLevel(level)
                category:category.c_str()
                  format:@"%@", [NSString stringWithUTF8String:message.c_str()] ?: @""];
        });
}

+ (void)openLogFile
{
    loader::openLogFile(toStdString(FileSystem.documents));
}

+ (void)scanAddons
{
    UnboundAddonState().scan(toStdString(FileSystem.documents));
}

+ (NSArray *)themes
{
    return arrayFromJSON(UnboundAddonState().themes());
}

static loader::FontOverrideRegistry &UnboundFontOverrides()
{
    static loader::FontOverrideRegistry registry;
    return registry;
}

+ (NSDictionary *)fontOverridePlan
{
    nlohmann::json targets =
        loader::fontOverrideTargets(loader::preferences::fontOverrides(UnboundSettingsStore()),
                                    UnboundAddonState().fonts(), UnboundPlatformFonts());
    id converted =
        objectFromJSON(loader::fontOverridePlanJSON(UnboundFontOverrides().plan(targets)));
    return [converted isKindOfClass:[NSDictionary class]] ? converted : @{};
}

+ (NSString *)everyFontFamily
{
    return @(loader::kAllFontFamilies);
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
                                            [] {
                                                return UnboundUpdateURL();
                                            },
                                            [] {
                                                return [CoreBridge mainBundleBytecodeVersion];
                                            },
                                            [] {
                                                return static_cast<bool>(UnboundBundleIsReady());
                                            }};
    std::string                     result =
        loader::toolbox::perform(context, toStdString(action), toStdString(argument));
    return [NSString stringWithUTF8String:result.c_str()] ?: @"";
}

+ (NSString *)preference:(NSString *)action argument:(NSString *)argument
{
    std::string result = loader::preferences::perform(UnboundSettingsStore(), toStdString(action),
                                                      toStdString(argument));
    return [NSString stringWithUTF8String:result.c_str()] ?: @"";
}

+ (BOOL)preferenceEnabled:(NSString *)action
{
    return [[self preference:action argument:@""] isEqualToString:@"true"];
}

+ (NSDictionary *)toolboxObject:(NSString *)action argument:(NSString *)argument
{
    nlohmann::json parsed =
        nlohmann::json::parse(toStdString([self toolbox:action argument:argument]), nullptr, false);
    id converted = parsed.is_object() ? objectFromJSON(parsed) : nil;
    return [converted isKindOfClass:[NSDictionary class]] ? converted : @{};
}

+ (NSArray *)toolboxArray:(NSString *)action argument:(NSString *)argument
{
    return arrayFromJSON(nlohmann::json::parse(toStdString([self toolbox:action argument:argument]),
                                               nullptr, false));
}

+ (NSDictionary *)toolboxMenu:(NSDictionary *)options
{
    return [self toolboxObject:@"menu" argument:@(jsonFromObject(options).dump().c_str())];
}

+ (NSTimeInterval)toolboxHoldDuration
{
    return loader::toolbox::kThreeFingerHoldMilliseconds / 1000.0;
}

static loader::devoverlay::Size coreSize(CGSize size)
{
    return {size.width, size.height};
}

static loader::devoverlay::Insets coreInsets(UIEdgeInsets insets)
{
    return {insets.top, insets.left, insets.bottom, insets.right};
}

+ (CGFloat)devOverlayButtonSide
{
    return loader::devoverlay::kButtonSide;
}

+ (CGPoint)devOverlayCenterInBounds:(CGSize)bounds insets:(UIEdgeInsets)insets
{
    loader::devoverlay::Point center = loader::devoverlay::buttonCenter(
        UnboundSettingsStore(), coreSize(bounds), coreInsets(insets));
    return CGPointMake(center.x, center.y);
}

+ (CGPoint)clampDevOverlayCenter:(CGPoint)center bounds:(CGSize)bounds insets:(UIEdgeInsets)insets
{
    loader::devoverlay::Point clamped =
        loader::devoverlay::clampCenter({center.x, center.y}, coreSize(bounds), coreInsets(insets));
    return CGPointMake(clamped.x, clamped.y);
}

+ (void)saveDevOverlayCenter:(CGPoint)center bounds:(CGSize)bounds
{
    loader::devoverlay::saveButtonCenter(UnboundSettingsStore(), {center.x, center.y},
                                         coreSize(bounds));
}

static CGRect cgRect(const loader::devoverlay::Frame &frame)
{
    return CGRectMake(frame.x, frame.y, frame.width, frame.height);
}

+ (CGRect)devOverlayButtonFrameForCenter:(CGPoint)center
{
    return cgRect(loader::devoverlay::buttonFrame({center.x, center.y}));
}

+ (CGRect)devOverlayCollapsedFrameForCenter:(CGPoint)center screen:(CGRect)screen
{
    return cgRect(loader::devoverlay::collapsedWindowFrame(
        {center.x, center.y},
        {screen.origin.x, screen.origin.y, screen.size.width, screen.size.height}));
}

+ (BOOL)devOverlayVisibleOnVirtualDevice:(BOOL)virtualDevice debugBuild:(BOOL)debugBuild
{
    return loader::preferences::devOverlayVisible(UnboundSettingsStore(), virtualDevice,
                                                  debugBuild);
}

+ (NSString *)incompatibleHostMessage
{
    return @(loader::diagnostics::kIncompatibleHostMessage);
}

+ (NSString *)developmentBuildBanner
{
    loader::diagnostics::BuildInfo info{toStdString(COMMIT_SHORT_HASH), toStdString(COMMIT_SUBJECT),
                                        toStdString(COMMIT_BRANCH), toStdString(BUILD_TIMESTAMP)};
    return unbound::ios::toNSString(loader::diagnostics::developmentBuildBanner(info));
}

+ (NSTimeInterval)developmentBuildBannerDuration
{
    return loader::diagnostics::kBannerSeconds;
}

@end
