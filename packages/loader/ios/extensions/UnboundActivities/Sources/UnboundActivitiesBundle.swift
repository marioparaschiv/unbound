import ActivityKit
import SwiftUI
import WidgetKit

@main
struct UnboundActivitiesBundle: WidgetBundle {
    var body: some Widget {
        UnboundActivityWidget()
    }
}

struct UnboundActivityWidget: Widget {
    var body: some WidgetConfiguration {
        ActivityConfiguration(for: UnboundActivityAttributes.self) { context in
            ActivityRow(state: context.state)
                .padding(16)
                .activityBackgroundTint(Color.black.opacity(0.6))
                .activitySystemActionForegroundColor(.white)
        } dynamicIsland: { context in
            DynamicIsland {
                DynamicIslandExpandedRegion(.leading) {
                    Symbol(state: context.state).font(.title2)
                }
                DynamicIslandExpandedRegion(.center) {
                    Titles(state: context.state)
                }
                DynamicIslandExpandedRegion(.bottom) {
                    Detail(state: context.state)
                }
            } compactLeading: {
                Symbol(state: context.state)
            } compactTrailing: {
                Detail(state: context.state).frame(maxWidth: 56)
            } minimal: {
                Symbol(state: context.state)
            }
        }
    }
}

struct ActivityRow: View {
    let state: UnboundActivityAttributes.ContentState

    var body: some View {
        HStack(spacing: 12) {
            Symbol(state: state).font(.title2)
            VStack(alignment: .leading, spacing: 4) {
                Titles(state: state)
                Detail(state: state)
            }
            Spacer(minLength: 0)
        }
    }
}

struct Titles: View {
    let state: UnboundActivityAttributes.ContentState

    var body: some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(state.title).font(.headline).foregroundColor(.white).lineLimit(1)
            if !state.subtitle.isEmpty {
                Text(state.subtitle).font(.subheadline).foregroundColor(.white.opacity(0.7)).lineLimit(2)
            }
        }
    }
}

struct Detail: View {
    let state: UnboundActivityAttributes.ContentState

    var body: some View {
        if let endsAt = state.endsAt {
            Text(timerInterval: Date()...max(Date(), endsAt), countsDown: true)
                .font(.caption.monospacedDigit())
                .foregroundColor(hexColor(state.tint))
        } else if let progress = state.progress {
            ProgressView(value: min(max(progress, 0), 1)).tint(hexColor(state.tint))
        }
    }
}

struct Symbol: View {
    let state: UnboundActivityAttributes.ContentState

    var body: some View {
        Image(systemName: state.symbol.isEmpty ? "bell.fill" : state.symbol)
            .foregroundColor(hexColor(state.tint))
    }
}

func hexColor(_ hex: String) -> Color {
    let digits = hex.trimmingCharacters(in: CharacterSet(charactersIn: "#"))
    guard digits.count == 6, let value = UInt32(digits, radix: 16) else { return .white }
    return Color(
        red: Double((value >> 16) & 0xFF) / 255,
        green: Double((value >> 8) & 0xFF) / 255,
        blue: Double(value & 0xFF) / 255
    )
}
