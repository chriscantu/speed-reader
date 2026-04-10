import CoreText
import MetricKit
import OSLog
import SwiftUI

@main
struct SpeedReaderApp: App {
    @State private var settings = ReaderSettings()

    init() {
        Self.registerCustomFonts()
        CrashDiagnosticsSubscriber.shared.register()
    }

    private static func registerCustomFonts() {
        guard let fontURL = Bundle.main.url(forResource: "OpenDyslexic-Regular", withExtension: "otf") else {
            assertionFailure("OpenDyslexic-Regular.otf missing from bundle")
            os_log(.error, "[SpeedReader] OpenDyslexic-Regular.otf not found in bundle — custom font unavailable")
            return
        }
        var error: Unmanaged<CFError>?
        if !CTFontManagerRegisterFontsForURL(fontURL as CFURL, .process, &error) {
            let description = error?.takeRetainedValue().localizedDescription ?? "unknown error"
            os_log(.error, "[SpeedReader] Font registration failed: %{public}@", description)
        }
    }

    var body: some Scene {
        WindowGroup {
            ContentView()
                .environment(settings)
        }
    }
}
