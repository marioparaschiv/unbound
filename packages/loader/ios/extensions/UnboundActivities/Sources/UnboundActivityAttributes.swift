import ActivityKit
import Foundation

struct UnboundActivityAttributes: ActivityAttributes {
    struct ContentState: Codable, Hashable {
        var title: String
        var subtitle: String
        var symbol: String
        var tint: String
        var progress: Double?
        var endsAt: Date?
    }

    var name: String
}
