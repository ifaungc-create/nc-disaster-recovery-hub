import UIKit
import Capacitor

/// The Capacitor web view for NC Disaster Recovery Hub, plus our own native plugin and widget deep links.
final class HubViewController: CAPBridgeViewController {
    private static let hubHost = "disaster-resources.app"

    override func capacitorDidLoad() {
        bridge?.registerPluginInstance(AppLockPlugin())
    }

    /// Opens a Hub screen such as "support/local". Only simple route text is accepted.
    func open(route: String, attempt: Int = 0) {
        let clean = route.trimmingCharacters(in: CharacterSet(charactersIn: "/"))
        guard clean.range(of: "^[a-z0-9_/-]{1,60}$", options: .regularExpression) != nil else { return }
        guard let web = webView else { return }
        // Wait for the Hub itself to finish loading (cold launch, or the offline page is showing).
        if web.isLoading || web.url?.host != Self.hubHost {
            if attempt < 24 {
                DispatchQueue.main.asyncAfter(deadline: .now() + 0.5) { [weak self] in self?.open(route: clean, attempt: attempt + 1) }
            }
            return
        }
        web.evaluateJavaScript("location.hash = '#\(clean)'", completionHandler: nil)
    }

    /// Opens a Hub link such as https://disaster-resources.app/#county/durham (Universal Links).
    /// Only the part after # is used, and only letters, numbers, / _ and - are accepted.
    func open(hubURL url: URL) {
        guard url.host?.lowercased() == Self.hubHost else { return }
        let frag = (url.fragment ?? "").trimmingCharacters(in: CharacterSet(charactersIn: "/"))
        if frag.isEmpty { open(route: "home"); return }
        guard frag.range(of: "^[A-Za-z0-9_/-]{1,80}$", options: .regularExpression) != nil else { return }
        openRaw(frag)
    }

    private func openRaw(_ frag: String, attempt: Int = 0) {
        guard let web = webView else { return }
        if web.isLoading || web.url?.host != Self.hubHost {
            if attempt < 24 {
                DispatchQueue.main.asyncAfter(deadline: .now() + 0.5) { [weak self] in self?.openRaw(frag, attempt: attempt + 1) }
            }
            return
        }
        web.evaluateJavaScript("location.hash = '#\(frag)'", completionHandler: nil)
    }
}
