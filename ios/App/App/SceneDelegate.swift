import UIKit
import Capacitor

class SceneDelegate: UIResponder, UIWindowSceneDelegate {
    var window: UIWindow?
    private var hub: HubViewController?

    func scene(_ scene: UIScene, willConnectTo session: UISceneSession, options connectionOptions: UIScene.ConnectionOptions) {
        guard let windowScene = scene as? UIWindowScene else { return }

        let vc = HubViewController()
        hub = vc
        window = UIWindow(windowScene: windowScene)
        window?.rootViewController = vc
        window?.makeKeyAndVisible()

        AppLock.shared.sceneDidConnect(windowScene)

        // Siri / Shortcuts actions (see HubIntents.swift).
        IntentRouter.shared.handler = { [weak self] action in
            switch action {
            case .route(let r): self?.hub?.open(route: r)
            case .url(let u): UIApplication.shared.open(u)
            }
        }

        SceneDelegateProxy.shared.scene(scene, willConnectTo: session, options: connectionOptions)

        // Widget tapped while the app was closed.
        for ctx in connectionOptions.urlContexts { openHubLink(ctx.url) }
        // Hub link (Universal Link) tapped while the app was closed.
        for activity in connectionOptions.userActivities where activity.activityType == NSUserActivityTypeBrowsingWeb {
            if let u = activity.webpageURL { hub?.open(hubURL: u) }
        }
    }

    func scene(_ scene: UIScene, openURLContexts URLContexts: Set<UIOpenURLContext>) {
        for ctx in URLContexts where ctx.url.scheme?.lowercased() == "ncdrh" { openHubLink(ctx.url) }
        SceneDelegateProxy.shared.scene(scene, openURLContexts: URLContexts)
    }

    func scene(_ scene: UIScene, continue userActivity: NSUserActivity) {
        if userActivity.activityType == NSUserActivityTypeBrowsingWeb, let u = userActivity.webpageURL { hub?.open(hubURL: u) }
        SceneDelegateProxy.shared.scene(scene, continue: userActivity)
    }

    func sceneWillResignActive(_ scene: UIScene) { AppLock.shared.sceneWillResignActive() }
    func sceneDidEnterBackground(_ scene: UIScene) { AppLock.shared.sceneDidEnterBackground() }
    func sceneWillEnterForeground(_ scene: UIScene) { AppLock.shared.sceneWillEnterForeground() }
    func sceneDidBecomeActive(_ scene: UIScene) { AppLock.shared.sceneDidBecomeActive() }

    /// ncdrh://notes/cases opens the app at #notes/cases.
    private func openHubLink(_ url: URL) {
        guard url.scheme?.lowercased() == "ncdrh" else { return }
        let route = ((url.host ?? "") + url.path).lowercased()
        hub?.open(route: route.isEmpty ? "home" : route)
    }
}
