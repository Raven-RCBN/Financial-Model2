# AgIntel Audit — Android test app

Android 8+ with an up-to-date Android System WebView. Test package `ai.agrinexus.audit`, version `0.1.0-test`. The APK connects to `https://fm2.digitalpalm.ai` and bundles the mobile UI locally so it can reopen offline.

## Field test

1. Install the supplied test APK. Sign in online with an active Audit account or the existing administrator account. Wait for “All changes synced”.
2. Turn on airplane mode. Create a finding, add photos from the camera/gallery and capture GPS if available. Save it. Reopen the app and confirm it remains visible.
3. An action author selects a responsible person from the cached Audit directory, with email filled automatically, and sets the action due date.
4. A respondent can enter replies, status and follow-up dates on actions assigned to their email. Each user first signs in online on their own device.
5. Reconnect with the app open. Sync sends queued changes in order and downloads current records and available evidence. Check Sync centre for conflicts or permission changes. Conflicting work is retained for review; it is never silently replaced.
6. Confirm the same finding, action and response are visible in the webapp. Retry sync: no duplicate records or replies should appear.

Only Audit modules appear. Administrator-only user/role management stays in the webapp. Existing FM2 finance access is not granted to Audit accounts. Admin is excluded from assignment choices. Audit permissions are always checked on the server when syncing; cached permissions cannot grant server access.

## Local mockup

Run the existing server with a **separate test database**, then open `/mobile-app/index.html`. “Explore local mockup” uses fictional sample data and never sends changes to the server. The account screen switches among sample creator, action author and respondent roles. The browser shell supports offline reload after service-worker installation; the APK needs no service worker.

## Build

Use JDK 17, Android SDK platform 35 and Gradle 8.13:

```sh
cd mobile/android
# ANDROID_HOME and JAVA_HOME must point to the installed SDK and JDK.
gradle :app:assembleDebug :app:lintDebug
```

Output: `app/build/outputs/apk/debug/app-debug.apk`. Debug signing is for installation/testing, not Play Store release. The repository contains no passwords or signing keys.

## Storage and sync behavior

- IndexedDB holds per-account records, drafts, compressed evidence images and pending operations. Passwords are never stored by app JavaScript; online sessions use the server's HttpOnly cookie.
- The last signed-in workspace can reopen offline. Signing out locks it until that account signs in online again. Shared devices should use a screen lock. Cached data is not separately encrypted by the app.
- API sessions expire after 12 hours. Offline capture continues; sync prompts for online sign-in if needed. A removed user's cached data cannot be remotely erased while their device is offline, but their changes are refused by the server.
- Sync runs while the app is open, upon reconnection/resume, and every 30 seconds with pending work. There is no background upload while the app is force-closed.
- Up to 12 observation photos per finding, compressed to 1600 pixels maximum edge. GPS is optional and depends on permission and signal. Previously uploaded images must finish downloading before they are available offline.
- Do not uninstall or clear app data until all changes are synced. A storage error is reported rather than claiming the change was saved.
- Native camera/GPS behavior needs a physical Android field test. This repository's browser tests validate offline data and API sync; they do not replace device testing.
