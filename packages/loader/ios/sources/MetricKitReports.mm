#import "MetricKitReports.h"

#import <MetricKit/MetricKit.h>
#import <mach-o/dyld.h>
#include <set>

#import "CoreConversions.h"
#import "FileSystem.h"
#include "LoaderMetricKitCrash.h"
#include "LoaderSystemExits.h"

using unbound::ios::toStdString;

@interface MetricKitReports () <MXMetricManagerSubscriber>
@end

static std::string payloadText(NSData *json)
{
    return json ? std::string(static_cast<const char *>(json.bytes), json.length) : std::string();
}

static std::set<std::string> loadedImageNames(void)
{
    std::set<std::string> names;
    for (uint32_t index = 0; index < _dyld_image_count(); index++)
    {
        const char *path = _dyld_get_image_name(index);
        if (path)
        {
            names.insert(toStdString(@(path).lastPathComponent));
        }
    }

    return names;
}

static bool shippedWithApp(const std::string &binary)
{
    NSString *name       = @(binary.c_str());
    NSString *frameworks = NSBundle.mainBundle.privateFrameworksPath;
    NSString *framework  = [name stringByAppendingPathExtension:@"framework"];
    NSFileManager *files = NSFileManager.defaultManager;
    return [files fileExistsAtPath:[frameworks stringByAppendingPathComponent:framework]] ||
           [files fileExistsAtPath:[frameworks stringByAppendingPathComponent:name]] ||
           [name isEqualToString:NSBundle.mainBundle.executablePath.lastPathComponent];
}

static void installImageCheck(void)
{
    std::set<std::string> loaded = loadedImageNames();
    loader::setMetricKitImageCheck([loaded](const std::string &binary) {
        return loaded.count(binary) > 0 || shippedWithApp(binary);
    });
}

@implementation MetricKitReports

+ (void)start
{
    static MetricKitReports *reports;
    static dispatch_once_t once;
    dispatch_once(&once, ^{
        dispatch_async(dispatch_get_global_queue(QOS_CLASS_UTILITY, 0), ^{
            installImageCheck();
            reports                  = [MetricKitReports new];
            MXMetricManager *manager = MXMetricManager.sharedManager;
            [manager addSubscriber:reports];
            [reports didReceiveMetricPayloads:manager.pastPayloads];
            [reports didReceiveDiagnosticPayloads:manager.pastDiagnosticPayloads];
        });
    });
}

- (void)didReceiveMetricPayloads:(NSArray<MXMetricPayload *> *)payloads
{
    std::string documents = toStdString(FileSystem.documents);
    for (MXMetricPayload *payload in payloads)
    {
        loader::system_exits::recordMetricKitMetrics(documents,
                                                     payloadText(payload.JSONRepresentation));
    }
}

- (void)didReceiveDiagnosticPayloads:(NSArray<MXDiagnosticPayload *> *)payloads
{
    std::string documents = toStdString(FileSystem.documents);
    for (MXDiagnosticPayload *payload in payloads)
    {
        loader::system_exits::recordMetricKitDiagnostics(documents,
                                                         payloadText(payload.JSONRepresentation));
    }
}

@end
