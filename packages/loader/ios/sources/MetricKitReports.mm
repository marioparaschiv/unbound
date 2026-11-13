#import "MetricKitReports.h"

#import <MetricKit/MetricKit.h>

#import "CoreConversions.h"
#import "FileSystem.h"
#include "LoaderSystemExits.h"

using unbound::ios::toStdString;

@interface MetricKitReports () <MXMetricManagerSubscriber>
@end

static std::string payloadText(NSData *json)
{
    return json ? std::string(static_cast<const char *>(json.bytes), json.length) : std::string();
}

@implementation MetricKitReports

+ (void)start
{
    static MetricKitReports *reports;
    static dispatch_once_t   once;
    dispatch_once(&once, ^{
        dispatch_async(dispatch_get_global_queue(QOS_CLASS_UTILITY, 0), ^{
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
