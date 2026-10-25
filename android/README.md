# Android app (Google Play) — Trusted Web Activity

The Android app is a **Trusted Web Activity (TWA)**: a small native wrapper that opens
https://disaster-resources.app full screen in Chrome (or another browser that supports TWAs).

**Why a TWA.** The site is already an installable, offline-capable PWA. A TWA keeps one codebase
(content fixes go live for Android users with the next web deploy, without a Play release), and web
push works through Chrome's *notification delegation*, so alerts show as notifications from the app.
Nothing extra is collected by the wrapper.

| | |
|---|---|
| Package (applicationId) | `app.disasterresources.nchub` — **can never change after the first upload** |
| Version | versionCode 1, versionName 1.0.0 (raise versionCode by 1 for every upload) |
| SDK | compileSdk 36, **targetSdk 36** (Android 16; Play requires 36 for new apps from Aug 31, 2026), minSdk 24 (Android 7.0, required by androidbrowserhelper 2.7.4) |
| Start URL | `https://disaster-resources.app/?source=android` |
| Fallback | Custom Tab if the browser has no TWA support |
| Release bundle | `android/release/app-release.aab` (signed with the upload key) |
| Libraries | `com.google.androidbrowserhelper:androidbrowserhelper:2.7.4`, AGP 8.13.2, Gradle 8.14.3, Java 17 |

## What the manifest declares
- `POST_NOTIFICATIONS` (Android 13+). The app never asks at launch: the permission prompt appears only
  after the person taps **Turn on alerts** on the Alerts screen (the web page calls
  `Notification.requestPermission()`, Chrome hands it to `NotificationPermissionRequestActivity`).
- `DelegationService` with a monochrome small icon (`ic_notification_icon`) for delegated notifications.
- Verified App Links (`autoVerify`) for `https://disaster-resources.app`.
- `allowBackup=false`. No other permissions (no location permission: location is asked by the web page
  only when "Use my location" is tapped, through Chrome).

## Build
```bash
export JAVA_HOME=/home/box/tools/jdk17 PATH=/home/box/tools/jdk17/bin:$PATH   # any JDK 17
# local.properties: sdk.dir=/path/to/android-sdk   (needs platforms;android-36 and build-tools;36.0.0)
S=/home/box/secrets/nc-disaster-hub/android
NCDRH_KEYSTORE=$S/upload-keystore.jks NCDRH_KEYSTORE_PASSWORD="$(cat $S/store_password.txt)" \
NCDRH_KEY_ALIAS=upload NCDRH_KEY_PASSWORD="$(cat $S/key_password.txt)" \
./gradlew --no-daemon bundleRelease
cp app/build/outputs/bundle/release/app-release.aab release/
```
Instead of environment variables you can create `android/keystore.properties` (git-ignored) with
`storeFile=…`, `storePassword=…`, `keyAlias=upload`, `keyPassword=…`.

Check a build: `jarsigner -verify release/app-release.aab` and
`java -jar bundletool.jar dump manifest --bundle release/app-release.aab`.

## Signing: upload key and Play App Signing
- The bundle is signed with the **upload key** (`upload-keystore.jks`, PKCS12, alias `upload`, RSA 4096, valid to 2054).
  Upload certificate SHA-256:
  `94:38:DA:C9:DB:50:A0:DC:4A:31:FA:AA:F1:81:9C:00:0B:E0:2C:A0:29:3E:5D:FC:AC:39:C6:43:FA:77:B4:31`
- New apps on Google Play use **Play App Signing**: on the first upload, accept "Let Google manage and
  protect your app signing key". Google re-signs the app with the **app signing key**, which is what
  users' phones see.
- **After the first upload**: Play Console → your app → *Test and release → Setup → App signing* (older menus: *Setup → App integrity*). Copy the
  **App signing key certificate SHA-256** and add it to `public/.well-known/assetlinks.json` next to the
  upload fingerprint (keep both), then deploy the website. Until you do, the app installed from Play
  will show a browser address bar at the top (the site cannot be verified). Play Console also shows a
  ready-made Digital Asset Links JSON on that page.
- **Status (2026-10-25): done.** Play app ID 4974956770726627957; internal release 1 (1.0.0) uploaded
  Oct 25 2026. `assetlinks.json` now lists both the upload key (`94:38:DA:…:B4:31`) and the Play app
  signing key (`89:47:EB:26:04:E2:0B:EE:CE:CD:6C:84:F1:CC:2E:93:7B:A8:AC:46:E8:6F:FD:10:F0:1D:84:E0:E3:AB:CE:EC`).

### Back up the upload key (do this now)
The keystore and its password live only in `/home/box/secrets/nc-disaster-hub/android/` (folder mode 700).
Copy `upload-keystore.jks` **and** the password into the organization's password manager or another
safe, encrypted place that more than one trusted person can reach. If the upload key is lost, the app
is not lost (Play App Signing holds the real signing key), but you must ask Google for an upload-key
reset from the account owner, which takes time. Never commit the keystore or passwords to git.

## Verify on a phone
1. Install from the internal-testing link.
2. It should open without an address bar (asset links verified). If you see a bar, check
   https://disaster-resources.app/.well-known/assetlinks.json has the Play app-signing SHA-256 and
   `Content-Type: application/json`.
3. Alerts → choose a topic → **Turn on alerts** → Android asks to allow notifications → Allow.
4. An admin sends a test alert (Admin → Alerts). The notification should show the app's icon.
