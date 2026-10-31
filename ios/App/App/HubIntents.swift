import AppIntents
import UIKit

// Siri, Spotlight and Shortcuts actions for NC Disaster Recovery Hub (iOS 16+).
// Say, for example: "Hey Siri, my case numbers in NC Recovery Hub" or "Find a hotel in NC Recovery Hub".
// Nothing here collects or sends data; each action opens a screen, starts a call, or speaks a short answer.

enum HubAction {
    case route(String)   // an app screen, e.g. "notes/cases"
    case url(URL)        // tel:, sms: or https: handled by iOS
}

/// Passes an action from an intent to the running Hub window.
final class IntentRouter {
    static let shared = IntentRouter()
    private var pending: HubAction?
    var handler: ((HubAction) -> Void)? {
        didSet { if let h = handler, let p = pending { pending = nil; DispatchQueue.main.async { h(p) } } }
    }

    func queue(_ action: HubAction) {
        if let h = handler { DispatchQueue.main.async { h(action) } } else { pending = action }
    }
}

enum HubScreen: String, AppEnum {
    case home, caseNumbers, referrals, myNotes, photos, help, counties, hotels, homeCare, food, translation, alerts, settings

    static let typeDisplayRepresentation: TypeDisplayRepresentation = "Recovery Hub screen"
    static let caseDisplayRepresentations: [HubScreen: DisplayRepresentation] = [
        .home: "Home",
        .caseNumbers: "My case numbers",
        .referrals: "My referrals",
        .myNotes: "My notes",
        .photos: "Photos and documents",
        .help: "Help and resources",
        .counties: "County help",
        .hotels: "Hotels near me",
        .homeCare: "Home care after a disaster",
        .food: "Cultural food pantries",
        .translation: "Translation help",
        .alerts: "Alerts",
        .settings: "Settings",
    ]

    var route: String {
        switch self {
        case .home: return "home"
        case .caseNumbers: return "notes/cases"
        case .referrals: return "notes/referrals"
        case .myNotes: return "notes/notes"
        case .photos: return "notes/photos"
        case .help: return "resources"
        case .counties: return "counties"
        case .hotels: return "hotels"
        case .homeCare: return "home-care"
        case .food: return "cultural-food"
        case .translation: return "translation"
        case .alerts: return "alerts"
        case .settings: return "settings"
        }
    }
}

struct OpenHubScreenIntent: AppIntent {
    static var title: LocalizedStringResource { "Open a Recovery Hub screen" }
    static var description: IntentDescription { IntentDescription("Opens a screen in NC Disaster Recovery Hub.") }
    static var openAppWhenRun: Bool { true }

    @Parameter(title: "Screen") var screen: HubScreen

    @MainActor
    func perform() async throws -> some IntentResult {
        IntentRouter.shared.queue(.route(screen.route))
        return .result()
    }
}

struct OpenRouteIntent {
    static func queue(_ r: String) { IntentRouter.shared.queue(.route(r)) }
}

struct MyCaseNumbersIntent: AppIntent {
    static var title: LocalizedStringResource { "My case numbers" }
    static var description: IntentDescription { IntentDescription("Opens your saved FEMA, insurance and other case numbers.") }
    static var openAppWhenRun: Bool { true }
    @MainActor func perform() async throws -> some IntentResult { OpenRouteIntent.queue("notes/cases"); return .result() }
}

struct TakeDocumentPhotoIntent: AppIntent {
    static var title: LocalizedStringResource { "Photos and documents" }
    static var description: IntentDescription { IntentDescription("Opens the photos of damage and documents kept on this phone.") }
    static var openAppWhenRun: Bool { true }
    @MainActor func perform() async throws -> some IntentResult { OpenRouteIntent.queue("notes/photos"); return .result() }
}

struct FindHotelIntent: AppIntent {
    static var title: LocalizedStringResource { "Find a hotel" }
    static var description: IntentDescription { IntentDescription("Opens hotels and motels near you.") }
    static var openAppWhenRun: Bool { true }
    @MainActor func perform() async throws -> some IntentResult { OpenRouteIntent.queue("hotels"); return .result() }
}

struct CountyHelpIntent: AppIntent {
    static var title: LocalizedStringResource { "County help" }
    static var description: IntentDescription { IntentDescription("Opens emergency management, social services and fire departments for your county.") }
    static var openAppWhenRun: Bool { true }
    @MainActor func perform() async throws -> some IntentResult { OpenRouteIntent.queue("counties"); return .result() }
}

struct Call911Intent: AppIntent {
    static var title: LocalizedStringResource { "Call 911" }
    static var description: IntentDescription { IntentDescription("Calls 911 for an emergency.") }
    static var openAppWhenRun: Bool { true }
    @MainActor func perform() async throws -> some IntentResult { IntentRouter.shared.queue(.url(URL(string: "tel://911")!)); return .result() }
}

struct Call211Intent: AppIntent {
    static var title: LocalizedStringResource { "Call 211 for local help" }
    static var description: IntentDescription { IntentDescription("Calls NC 211 for shelter, food and local help.") }
    static var openAppWhenRun: Bool { true }
    @MainActor func perform() async throws -> some IntentResult { IntentRouter.shared.queue(.url(URL(string: "tel://211")!)); return .result() }
}

struct CallFEMAIntent: AppIntent {
    static var title: LocalizedStringResource { "Call the FEMA Helpline" }
    static var description: IntentDescription { IntentDescription("Calls the FEMA Helpline, 1-800-621-3362.") }
    static var openAppWhenRun: Bool { true }
    @MainActor func perform() async throws -> some IntentResult { IntentRouter.shared.queue(.url(URL(string: "tel://18006213362")!)); return .result() }
}

struct CallRedCrossIntent: AppIntent {
    static var title: LocalizedStringResource { "Call the Red Cross" }
    static var description: IntentDescription { IntentDescription("Calls the American Red Cross, 1-800-733-2767.") }
    static var openAppWhenRun: Bool { true }
    @MainActor func perform() async throws -> some IntentResult { IntentRouter.shared.queue(.url(URL(string: "tel://18007332767")!)); return .result() }
}

struct EmergencyInfoIntent: AppIntent {
    static var title: LocalizedStringResource { "Who to call after a disaster" }
    static var description: IntentDescription { IntentDescription("Says the main numbers to call after a disaster.") }
    func perform() async throws -> some IntentResult & ProvidesDialog {
        .result(dialog: "In an emergency, call 9 1 1. For shelter, food and local help, call 2 1 1. The FEMA Helpline is 1 8 0 0, 6 2 1, 3 3 6 2. The Red Cross is 1 8 0 0, 7 3 3, 2 7 6 7. This app is not a government service.")
    }
}

struct HubShortcuts: AppShortcutsProvider {
    static var appShortcuts: [AppShortcut] {
        AppShortcut(intent: MyCaseNumbersIntent(),
                    phrases: ["My case numbers in \(.applicationName)", "Show my case numbers in \(.applicationName)"],
                    shortTitle: "Case numbers", systemImageName: "number.square.fill")
        AppShortcut(intent: TakeDocumentPhotoIntent(),
                    phrases: ["My documents in \(.applicationName)", "Damage photos in \(.applicationName)"],
                    shortTitle: "Photos and documents", systemImageName: "camera.fill")
        AppShortcut(intent: Call211Intent(),
                    phrases: ["Call 211 in \(.applicationName)", "Local help in \(.applicationName)"],
                    shortTitle: "Call 211", systemImageName: "phone.fill")
        AppShortcut(intent: CallFEMAIntent(),
                    phrases: ["Call FEMA in \(.applicationName)", "FEMA Helpline in \(.applicationName)"],
                    shortTitle: "Call FEMA", systemImageName: "phone.arrow.up.right")
        AppShortcut(intent: CallRedCrossIntent(),
                    phrases: ["Call the Red Cross in \(.applicationName)"],
                    shortTitle: "Call Red Cross", systemImageName: "cross.fill")
        AppShortcut(intent: FindHotelIntent(),
                    phrases: ["Find a hotel in \(.applicationName)", "I need a place to stay in \(.applicationName)"],
                    shortTitle: "Find a hotel", systemImageName: "bed.double.fill")
        AppShortcut(intent: CountyHelpIntent(),
                    phrases: ["County help in \(.applicationName)", "My county in \(.applicationName)"],
                    shortTitle: "County help", systemImageName: "mappin.and.ellipse")
        AppShortcut(intent: EmergencyInfoIntent(),
                    phrases: ["Who do I call in \(.applicationName)", "Who to call after a disaster in \(.applicationName)"],
                    shortTitle: "Who to call", systemImageName: "info.circle.fill")
        AppShortcut(intent: OpenHubScreenIntent(),
                    phrases: ["Open \(\.$screen) in \(.applicationName)", "Show \(\.$screen) in \(.applicationName)"],
                    shortTitle: "Open a screen", systemImageName: "square.grid.2x2.fill")
    }
}
