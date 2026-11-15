import ActivityKit
import Foundation

@available(iOS 16.1, *)
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

private struct ActivityRequest: Decodable {
    var name: String?
    var title: String
    var subtitle: String?
    var symbol: String?
    var tint: String?
    var progress: Double?
    var endsAt: Double?

    @available(iOS 16.1, *)
    var state: UnboundActivityAttributes.ContentState {
        UnboundActivityAttributes.ContentState(
            title: title,
            subtitle: subtitle ?? "",
            symbol: symbol ?? "",
            tint: tint ?? "",
            progress: progress,
            endsAt: endsAt.map { Date(timeIntervalSince1970: $0 / 1000) }
        )
    }
}

@objc(UnboundLiveActivities)
final class UnboundLiveActivities: NSObject {
    private static let extensionName = "UnboundActivities.appex"

    @objc static func isAvailable() -> Bool {
        guard #available(iOS 16.1, *) else { return false }
        let plugins = Bundle.main.builtInPlugInsURL?.appendingPathComponent(extensionName).path ?? ""
        return FileManager.default.fileExists(atPath: plugins)
            && ActivityAuthorizationInfo().areActivitiesEnabled
    }

    @objc static func start(_ json: String) -> String? {
        guard #available(iOS 16.1, *), isAvailable(), let request = decode(json) else { return nil }
        let attributes = UnboundActivityAttributes(name: request.name ?? "")
        return try? Activity<UnboundActivityAttributes>.request(
            attributes: attributes, contentState: request.state, pushType: nil
        ).id
    }

    @objc static func update(_ id: String, json: String) -> Bool {
        guard #available(iOS 16.1, *), let request = decode(json), let activity = activity(id) else {
            return false
        }
        Task { await activity.update(using: request.state) }
        return true
    }

    @objc static func activities() -> String {
        guard #available(iOS 16.1, *) else { return "[]" }
        let listed = Activity<UnboundActivityAttributes>.activities.map { ["id": $0.id, "name": $0.attributes.name] }
        let data = (try? JSONSerialization.data(withJSONObject: listed)) ?? Data("[]".utf8)
        return String(decoding: data, as: UTF8.self)
    }

    @objc static func end(_ id: String) -> Bool {
        guard #available(iOS 16.1, *), let activity = activity(id) else { return false }
        Task { await activity.end(dismissalPolicy: .immediate) }
        return true
    }

    @available(iOS 16.1, *)
    private static func activity(_ id: String) -> Activity<UnboundActivityAttributes>? {
        Activity<UnboundActivityAttributes>.activities.first { $0.id == id }
    }

    private static func decode(_ json: String) -> ActivityRequest? {
        guard let data = json.data(using: .utf8) else { return nil }
        return try? JSONDecoder().decode(ActivityRequest.self, from: data)
    }
}
