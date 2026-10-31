import UIKit
import LocalAuthentication
import Capacitor

/// Optional Face ID / Touch ID / device passcode lock for the NC Disaster Recovery Hub.
///
/// - Off by default. A member turns it on from Profile in the app, or from iOS Settings > NC Disaster Recovery Hub.
/// - Locks on cold launch and when the app returns after more than `graceSeconds` in the background.
/// - While the app is inactive (app switcher, Control Center) a cover hides the screen.
/// - The lock screen always offers a one-tap 911 call, so locking never blocks someone who needs help.
/// - If the device has no passcode set, the app is never locked (no lock-out).
final class AppLock {
    static let shared = AppLock()
    static let enabledKey = "ncdrh.applock.enabled"

    private let graceSeconds: TimeInterval = 30
    private var overlay: UIWindow?
    private var lockVC: LockViewController?
    private var backgroundedAt: Date?
    private var locked = false
    private var authenticating = false
    private var lastAttemptEnd: Date?

    var isEnabled: Bool { UserDefaults.standard.bool(forKey: Self.enabledKey) }

    /// True when this device can authenticate with Face ID, Touch ID or a passcode.
    var isAvailable: Bool {
        var err: NSError?
        return LAContext().canEvaluatePolicy(.deviceOwnerAuthentication, error: &err)
    }

    var biometryName: String {
        let ctx = LAContext()
        var err: NSError?
        guard ctx.canEvaluatePolicy(.deviceOwnerAuthentication, error: &err) else { return "none" }
        switch ctx.biometryType {
        case .faceID: return "faceID"
        case .touchID: return "touchID"
        case .none: return "passcode"
        @unknown default: return "biometrics"
        }
    }

    func setEnabled(_ on: Bool) {
        UserDefaults.standard.set(on, forKey: Self.enabledKey)
        if !on { locked = false; hideOverlay() }
    }

    // MARK: Scene lifecycle (called from SceneDelegate)

    func sceneDidConnect(_ scene: UIWindowScene) {
        buildOverlay(in: scene)
        if isEnabled && isAvailable { locked = true; showOverlay(locked: true) }
    }

    func sceneWillResignActive() {
        guard isEnabled, isAvailable else { return }
        showOverlay(locked: locked)
    }

    func sceneDidEnterBackground() {
        backgroundedAt = Date()
    }

    func sceneWillEnterForeground() {
        guard isEnabled, isAvailable else { return }
        if let t = backgroundedAt, Date().timeIntervalSince(t) > graceSeconds { locked = true }
    }

    func sceneDidBecomeActive() {
        guard isEnabled, isAvailable else { locked = false; hideOverlay(); return }
        if locked {
            showOverlay(locked: true)
            if !authenticating, lastAttemptEnd.map({ Date().timeIntervalSince($0) > 1.5 }) ?? true {
                authenticate(reason: "Unlock NC Disaster Recovery Hub", completion: nil)
            }
        } else {
            hideOverlay()
        }
    }

    // MARK: Authentication

    /// Ask the system to verify the owner. Used to unlock and to confirm before turning the lock on.
    func authenticate(reason: String, completion: ((Bool, String?) -> Void)?) {
        guard !authenticating else { return }
        let ctx = LAContext()
        var err: NSError?
        guard ctx.canEvaluatePolicy(.deviceOwnerAuthentication, error: &err) else {
            // No passcode on this device: do not lock the member out.
            locked = false; hideOverlay()
            completion?(false, "Set a passcode in iPhone Settings first, then try again.")
            return
        }
        authenticating = true
        ctx.evaluatePolicy(.deviceOwnerAuthentication, localizedReason: reason) { [weak self] ok, error in
            DispatchQueue.main.async {
                guard let self = self else { return }
                self.authenticating = false
                self.lastAttemptEnd = Date()
                if ok {
                    self.locked = false
                    self.hideOverlay()
                    completion?(true, nil)
                } else {
                    completion?(false, error?.localizedDescription)
                }
            }
        }
    }

    func unlockButtonTapped() {
        authenticate(reason: "Unlock NC Disaster Recovery Hub", completion: nil)
    }

    // MARK: Overlay

    private func buildOverlay(in scene: UIWindowScene) {
        let w = UIWindow(windowScene: scene)
        w.windowLevel = UIWindow.Level.alert + 1
        let vc = LockViewController()
        w.rootViewController = vc
        w.isHidden = true
        overlay = w
        lockVC = vc
    }

    private func showOverlay(locked: Bool) {
        lockVC?.setLocked(locked)
        overlay?.isHidden = false
    }

    private func hideOverlay() {
        overlay?.isHidden = true
    }
}

/// Full-screen navy view with the app logo. In "cover" mode it only hides content; in "locked" mode it adds buttons.
final class LockViewController: UIViewController {
    private let stack = UIStackView()
    private let title1 = UILabel()
    private let detail = UILabel()
    private let unlock = UIButton(type: .system)
    private let crisis = UIButton(type: .system)

    override var preferredStatusBarStyle: UIStatusBarStyle { .lightContent }

    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = UIColor(red: 18.0 / 255, green: 53.0 / 255, blue: 91.0 / 255, alpha: 1)

        let logo = UIImageView(image: UIImage(named: "LockLogo"))
        logo.contentMode = .scaleAspectFit
        logo.isAccessibilityElement = false
        logo.translatesAutoresizingMaskIntoConstraints = false
        logo.heightAnchor.constraint(equalToConstant: 140).isActive = true

        title1.text = "NC Disaster Recovery Hub is locked"
        title1.font = UIFont.preferredFont(forTextStyle: .title2)
        title1.adjustsFontForContentSizeCategory = true
        title1.textColor = .white
        title1.textAlignment = .center
        title1.numberOfLines = 0

        detail.text = "Use Face ID, Touch ID or your passcode to open the app.\nUse Face ID, Touch ID o su código para abrir la aplicación."
        detail.font = UIFont.preferredFont(forTextStyle: .body)
        detail.adjustsFontForContentSizeCategory = true
        detail.textColor = UIColor(white: 1, alpha: 0.8)
        detail.textAlignment = .center
        detail.numberOfLines = 0

        var unlockCfg = UIButton.Configuration.filled()
        unlockCfg.title = "Unlock"
        unlockCfg.baseBackgroundColor = UIColor(red: 0.83, green: 0.65, blue: 0.17, alpha: 1)
        unlockCfg.baseForegroundColor = UIColor(red: 1.0 / 255, green: 28.0 / 255, blue: 54.0 / 255, alpha: 1)
        unlockCfg.cornerStyle = .large
        unlockCfg.contentInsets = NSDirectionalEdgeInsets(top: 14, leading: 36, bottom: 14, trailing: 36)
        unlock.configuration = unlockCfg
        unlock.addTarget(self, action: #selector(tapUnlock), for: .touchUpInside)
        unlock.accessibilityLabel = "Unlock NC Disaster Recovery Hub"

        var crisisCfg = UIButton.Configuration.plain()
        crisisCfg.title = "Emergency? Call 911. · ¿Emergencia? Llame al 911."
        crisisCfg.baseForegroundColor = .white
        crisisCfg.contentInsets = NSDirectionalEdgeInsets(top: 12, leading: 12, bottom: 12, trailing: 12)
        crisis.configuration = crisisCfg
        crisis.titleLabel?.numberOfLines = 0
        crisis.addTarget(self, action: #selector(tapCrisis), for: .touchUpInside)
        crisis.accessibilityLabel = "Call 911 for an emergency."

        [logo, title1, detail, unlock, crisis].forEach { stack.addArrangedSubview($0) }
        stack.axis = .vertical
        stack.alignment = .center
        stack.spacing = 18
        stack.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(stack)
        NSLayoutConstraint.activate([
            stack.centerYAnchor.constraint(equalTo: view.centerYAnchor),
            stack.leadingAnchor.constraint(equalTo: view.layoutMarginsGuide.leadingAnchor, constant: 12),
            stack.trailingAnchor.constraint(equalTo: view.layoutMarginsGuide.trailingAnchor, constant: -12),
        ])
        setLocked(false)
    }

    func setLocked(_ locked: Bool) {
        loadViewIfNeeded()
        title1.isHidden = !locked
        detail.isHidden = !locked
        unlock.isHidden = !locked
        crisis.isHidden = !locked
    }

    @objc private func tapUnlock() { AppLock.shared.unlockButtonTapped() }

    @objc private func tapCrisis() {
        if let url = URL(string: "tel://911") { UIApplication.shared.open(url) }
    }
}

/// Lets the web app (served from disaster-resources.app) read and change the lock setting:
/// `Capacitor.Plugins.AppLock.status()` and `Capacitor.Plugins.AppLock.setEnabled({ enabled: true })`.
@objc(AppLockPlugin)
public class AppLockPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "AppLockPlugin"
    public let jsName = "AppLock"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "status", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "setEnabled", returnType: CAPPluginReturnPromise),
    ]

    private func state() -> [String: Any] {
        ["enabled": AppLock.shared.isEnabled, "available": AppLock.shared.isAvailable, "biometry": AppLock.shared.biometryName]
    }

    @objc func status(_ call: CAPPluginCall) {
        call.resolve(state())
    }

    @objc func setEnabled(_ call: CAPPluginCall) {
        let want = call.getBool("enabled") ?? false
        if !want {
            AppLock.shared.setEnabled(false)
            call.resolve(state())
            return
        }
        // Turning it on requires one successful unlock, so a member can never switch on a lock that does not work.
        DispatchQueue.main.async {
            AppLock.shared.authenticate(reason: "Turn on the lock for NC Disaster Recovery Hub") { ok, message in
                if ok {
                    AppLock.shared.setEnabled(true)
                    call.resolve(self.state())
                } else {
                    call.reject(message ?? "The lock was not turned on.")
                }
            }
        }
    }
}
