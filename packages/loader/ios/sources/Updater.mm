#include <istream>
#include <ostream>
#include <streambuf>

#import "CoreConversions.h"
#import "CoreBridge.h"
#import "SettingsCore.h"
#import "Updater.h"
#import "UpdaterCore.h"

#include "LoaderHotReload.h"
#include "LoaderUpdater.h"

using unbound::ios::toNSString;
using unbound::ios::toStdString;

static bool isServingBundle(NSURL *url, NSTimeInterval timeout)
{
    NSMutableURLRequest *request =
        [NSMutableURLRequest requestWithURL:url
                                cachePolicy:NSURLRequestReloadIgnoringCacheData
                            timeoutInterval:timeout];
    request.HTTPMethod = @"HEAD";

    dispatch_semaphore_t semaphore = dispatch_semaphore_create(0);
    __block BOOL         serving   = NO;

    NSURLSessionDataTask *task = [[NSURLSession sharedSession]
        dataTaskWithRequest:request
          completionHandler:^(NSData *data, NSURLResponse *response, NSError *error) {
              serving = !error && [(NSHTTPURLResponse *) response statusCode] == 200;
              dispatch_semaphore_signal(semaphore);
          }];
    [task resume];

    if (dispatch_semaphore_wait(semaphore, dispatch_time(DISPATCH_TIME_NOW,
                                                         (int64_t) (timeout * NSEC_PER_SEC))) != 0)
    {
        [task cancel];
        return NO;
    }

    return serving;
}

static loader::UpdaterSettings iosUpdaterSettings()
{
    return loader::updaterSettings(UnboundSettingsStore());
}

static std::optional<std::string> fetchText(const std::string &url, double timeout)
{
    NSData *data = [Utilities fetchDataWithTimeout:[NSURL URLWithString:toNSString(url)] timeout:timeout];
    if (!data)
    {
        return std::nullopt;
    }
    return std::string(static_cast<const char *>(data.bytes), data.length);
}

static std::optional<loader::DownloadResult> download(const std::string &url,
                                                      const std::string &destination,
                                                      const std::map<std::string, std::string> &headers,
                                                      const loader::DownloadPolicy &policy)
{
    NSMutableDictionary *requestHeaders = [NSMutableDictionary dictionary];
    for (const auto &[key, value] : headers)
    {
        requestHeaders[toNSString(key)] = toNSString(value);
    }

    @try
    {
        NSHTTPURLResponse *response = [FileSystem download:[NSURL URLWithString:toNSString(url)]
                                                      path:toNSString(destination)
                                               withHeaders:requestHeaders
                                            requestTimeout:policy.readTimeoutSeconds
                                              totalTimeout:policy.totalTimeoutSeconds];
        loader::DownloadResult result;
        result.status = static_cast<int>(response.statusCode);
        result.etag   = toStdString([response valueForHTTPHeaderField:@"etag"] ?: @"");
        return result;
    }
    @catch (NSException *exception)
    {
        [Logger error:LOG_CATEGORY_UPDATER format:@"Bundle download failed. (%@)", exception.reason];
        return std::nullopt;
    }
}

static loader::BundleUpdater &bundleUpdater()
{
    static loader::BundleUpdater *updater = nullptr;
    static dispatch_once_t        onceToken;
    dispatch_once(&onceToken, ^{
        [FileSystem init];
        updater = new loader::BundleUpdater(toStdString(FileSystem.documents), iosUpdaterSettings(),
                                            fetchText, download);
    });
    return *updater;
}

static NSException *updaterException(const std::exception &error)
{
    return [[NSException alloc] initWithName:@"BundleUpdateFailed"
                                      reason:toNSString(error.what())
                                    userInfo:nil];
}

static std::optional<std::string> optionalUpdateURL()
{
    NSString *updateURL = [Updater resolveUpdateURL];
    return updateURL ? std::optional<std::string>(toStdString(updateURL)) : std::nullopt;
}

loader::BundleUpdater &UnboundBundleUpdater()
{
    return bundleUpdater();
}

loader::UpdaterSettings UnboundUpdaterSettings()
{
    return iosUpdaterSettings();
}

std::optional<std::string> UnboundUpdateURL()
{
    return optionalUpdateURL();
}

@implementation Updater

+ (NSString *)resolveUpdateURL
{
    NSString                  *hostAddress = [Utilities getVirtualDeviceHostAddress];
    std::optional<std::string> url         = loader::resolveUpdateURL(
        iosUpdaterSettings(), hostAddress ? std::optional<std::string>(toStdString(hostAddress)) : std::nullopt,
        [](const std::string &probe, double timeout) {
            return isServingBundle([NSURL URLWithString:toNSString(probe)], timeout);
        });
    return url ? toNSString(*url) : nil;
}

+ (NSString *)resolveBundlePath
{
    try
    {
        return toNSString(bundleUpdater().resolveBundlePath());
    }
    catch (const std::exception &error)
    {
        @throw updaterException(error);
    }
}

+ (NSString *)downloadBundle:(NSString *)preferredPath
{
    try
    {
        return toNSString(bundleUpdater().downloadBundle(toStdString(preferredPath), optionalUpdateURL(),
                                                         [CoreBridge mainBundleBytecodeVersion]));
    }
    catch (const std::exception &error)
    {
        @throw updaterException(error);
    }
}

+ (BOOL)markBundleAttempted:(NSString *)path
{
    return bundleUpdater().markBundleAttempted(toStdString(path));
}

+ (BOOL)acceptBundle:(NSString *)path
{
    return bundleUpdater().acceptBundle(toStdString(path));
}

+ (void)rejectBundle:(NSString *)path
{
    bundleUpdater().rejectBundle(toStdString(path));
}

+ (NSURL *)getDownloadURL
{
    return [NSURL URLWithString:toNSString(bundleUpdater().downloadURL(
                                    optionalUpdateURL(), [CoreBridge mainBundleBytecodeVersion]))];
}

@end
