#include <istream>
#include <ostream>
#include <streambuf>

#import "Updater.h"
#import "UpdaterCore.h"

#include "LoaderUpdater.h"

// `bun run serve` in the client repo serves its build from this port on the Mac.
static const NSInteger      kDevServerPort         = 3000;
static NSString *const      kDevServerProbePath    = @"manifest.json";
static const NSTimeInterval kDevServerProbeTimeout = 1.5;

static BOOL isServingBundle(NSURL *url)
{
    NSMutableURLRequest *request =
        [NSMutableURLRequest requestWithURL:url
                                cachePolicy:NSURLRequestReloadIgnoringCacheData
                            timeoutInterval:kDevServerProbeTimeout];
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
                                                         (int64_t) (kDevServerProbeTimeout *
                                                                    NSEC_PER_SEC))) != 0)
    {
        [task cancel];
        return NO;
    }

    return serving;
}

static std::string toStdString(NSString *value)
{
    const char *utf8 = value.UTF8String;
    return utf8 ? std::string(utf8) : std::string();
}

static NSString *toNSString(const std::string &value)
{
    return [NSString stringWithUTF8String:value.c_str()] ?: @"";
}

static loader::UpdaterSettings iosUpdaterSettings()
{
    loader::UpdaterSettings settings;
    settings.getString = [](const std::string &key, const std::string &fallback) {
        NSString *value = [Settings getString:@"unbound" key:toNSString(key) def:toNSString(fallback)];
        return [value isKindOfClass:[NSString class]] ? toStdString(value) : fallback;
    };
    settings.getBoolean = [](const std::string &key, bool fallback) {
        return static_cast<bool>([Settings getBoolean:@"unbound" key:toNSString(key) def:fallback]);
    };
    settings.setString = [](const std::string &key, const std::string &value) {
        [Settings set:@"unbound" key:toNSString(key) value:toNSString(value)];
    };
    return settings;
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
                                                      const std::map<std::string, std::string> &headers)
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
                                               withHeaders:requestHeaders];
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
    NSString *configuredURL = [Settings getString:@"unbound" key:@"loader.update.url" def:nil];
    if (configuredURL)
    {
        return configuredURL;
    }

    NSString *hostAddress = [Utilities getVirtualDeviceHostAddress];
    if (!hostAddress)
    {
        return nil;
    }

    NSString *devServerURL =
        [NSString stringWithFormat:@"http://%@:%ld/", hostAddress, (long) kDevServerPort];
    if (!isServingBundle([NSURL URLWithString:[devServerURL stringByAppendingString:kDevServerProbePath]]))
    {
        [Logger info:LOG_CATEGORY_UPDATER
              format:@"Virtual device: %@ is not reachable; using the default update URL.",
                     devServerURL];
        return nil;
    }

    [Logger info:LOG_CATEGORY_UPDATER format:@"Virtual device: using %@.", devServerURL];
    return devServerURL;
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
                                                         [Utilities getHermesBytecodeVersion]));
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
                                    optionalUpdateURL(), [Utilities getHermesBytecodeVersion]))];
}

@end
