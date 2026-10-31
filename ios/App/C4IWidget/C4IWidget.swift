import WidgetKit
import SwiftUI

// NC Help Numbers: Home Screen and Lock Screen widget for NC Disaster Recovery Hub.
// Everything here works offline and needs no sign-in. Taps open the Phone app or the app itself.
// This app is not a government service; the numbers below are the public lines people call after a disaster.

private let navy = Color(red: 18.0 / 255, green: 53.0 / 255, blue: 91.0 / 255)      // #12355B
private let blue = Color(red: 31.0 / 255, green: 92.0 / 255, blue: 153.0 / 255)     // #1F5C99
private let emergencyRed = Color(red: 0.70, green: 0.12, blue: 0.12)

private let url911 = URL(string: "tel://911")!
private let url211 = URL(string: "tel://211")!
private let urlFEMA = URL(string: "tel://18006213362")!
private let urlRedCross = URL(string: "tel://18007332767")!
private let urlCases = URL(string: "ncdrh://notes/cases")!

private let dailyLines = [
    "Keep your case numbers in one place.",
    "Write down who you talked to and when.",
    "Take photos of damage before repairs.",
    "Ask for every decision in writing.",
    "Keep receipts for hotels and repairs.",
    "Check on a neighbor today.",
    "Recovery takes time. One step at a time.",
]

struct QuickHelpEntry: TimelineEntry {
    let date: Date
    let line: String
}

struct QuickHelpProvider: TimelineProvider {
    private func line(for date: Date) -> String {
        let day = Calendar.current.ordinality(of: .day, in: .era, for: date) ?? 0
        return dailyLines[day % dailyLines.count]
    }

    func placeholder(in context: Context) -> QuickHelpEntry { QuickHelpEntry(date: Date(), line: dailyLines[0]) }

    func getSnapshot(in context: Context, completion: @escaping (QuickHelpEntry) -> Void) {
        completion(QuickHelpEntry(date: Date(), line: line(for: Date())))
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<QuickHelpEntry>) -> Void) {
        let cal = Calendar.current
        let today = cal.startOfDay(for: Date())
        let entries = (0..<7).compactMap { offset -> QuickHelpEntry? in
            guard let d = cal.date(byAdding: .day, value: offset, to: today) else { return nil }
            return QuickHelpEntry(date: d, line: line(for: d))
        }
        completion(Timeline(entries: entries, policy: .atEnd))
    }
}

private extension View {
    /// Navy widget background that works on iOS 16 and 17+.
    @ViewBuilder func widgetNavy() -> some View {
        if #available(iOS 17.0, *) {
            self.containerBackground(navy, for: .widget)
        } else {
            self.background(navy)
        }
    }
}

private struct Tile: View {
    let symbol: String
    let title: String
    let subtitle: String
    let fill: Color

    var body: some View {
        VStack(spacing: 3) {
            Image(systemName: symbol).font(.subheadline.weight(.semibold))
            Text(title).font(.footnote.weight(.bold)).lineLimit(1).minimumScaleFactor(0.7)
            Text(subtitle).font(.caption2).lineLimit(1).minimumScaleFactor(0.6)
        }
        .foregroundColor(.white)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(fill)
        .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
    }
}

struct QuickHelpView: View {
    @Environment(\.widgetFamily) var family
    let entry: QuickHelpEntry

    var body: some View {
        switch family {
        case .accessoryCircular:
            ZStack {
                AccessoryWidgetBackground()
                VStack(spacing: 0) {
                    Image(systemName: "phone.fill").font(.caption)
                    Text("211").font(.headline.weight(.bold))
                }
            }
            .widgetURL(url211)
        case .accessoryRectangular:
            VStack(alignment: .leading, spacing: 2) {
                Text("NC 211 local help").font(.headline).lineLimit(1).minimumScaleFactor(0.8)
                Text("Shelter, food, local help").font(.caption)
                Text("Emergency: 911").font(.caption2).foregroundStyle(.secondary)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .widgetURL(url211)
        case .accessoryInline:
            Label("Local help: call 211", systemImage: "phone.fill").widgetURL(url211)
        case .systemMedium:
            VStack(alignment: .leading, spacing: 6) {
                HStack(spacing: 6) {
                    Text("NC Help Numbers").font(.subheadline.weight(.bold)).foregroundColor(.white)
                    Spacer()
                    Text(entry.line).font(.caption2).foregroundColor(.white.opacity(0.8)).lineLimit(1).minimumScaleFactor(0.6)
                }
                HStack(spacing: 6) {
                    Link(destination: url911) { Tile(symbol: "phone.fill", title: "911", subtitle: "Emergency", fill: emergencyRed) }
                    Link(destination: url211) { Tile(symbol: "house.fill", title: "211", subtitle: "Local help", fill: blue) }
                    Link(destination: urlFEMA) { Tile(symbol: "phone.arrow.up.right", title: "FEMA", subtitle: "800-621-3362", fill: .white.opacity(0.16)) }
                    Link(destination: urlCases) { Tile(symbol: "number.square.fill", title: "My cases", subtitle: "Case numbers", fill: .white.opacity(0.16)) }
                }
            }
            .widgetNavy()
        default: // systemSmall: one tap target (iOS opens a single link for small widgets)
            VStack(alignment: .leading, spacing: 4) {
                Text("NC Help Numbers").font(.caption.weight(.bold)).foregroundColor(.white.opacity(0.85))
                Spacer(minLength: 0)
                HStack(spacing: 6) { Image(systemName: "phone.fill"); Text("911").font(.title3.weight(.bold)); Text("Emergency").font(.caption) }
                    .foregroundColor(.white)
                HStack(spacing: 6) { Image(systemName: "house.fill"); Text("211").font(.title3.weight(.bold)); Text("Local help").font(.caption) }
                    .foregroundColor(.white)
                Text("Tap to call 211").font(.caption2).foregroundColor(.white.opacity(0.8))
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .leading)
            .widgetURL(url211)
            .widgetNavy()
        }
    }
}

struct QuickHelpWidget: Widget {
    let kind = "NCHelpNumbers"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: QuickHelpProvider()) { entry in
            QuickHelpView(entry: entry)
        }
        .configurationDisplayName("NC Help Numbers")
        .description("One tap to call 911, NC 211, the FEMA Helpline, or open your case numbers. Not a government service.")
        .supportedFamilies([.systemSmall, .systemMedium, .accessoryCircular, .accessoryRectangular, .accessoryInline])
    }
}

@main
struct C4IWidgetBundle: WidgetBundle {
    var body: some Widget {
        QuickHelpWidget()
    }
}
