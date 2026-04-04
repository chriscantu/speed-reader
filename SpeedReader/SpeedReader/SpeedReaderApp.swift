import CoreText
import SwiftUI

@main
struct SpeedReaderApp: App {
    @State private var settings = ReaderSettings()

    init() {
        Self.registerCustomFonts()
    }

    private static func registerCustomFonts() {
        guard let fontURL = Bundle.main.url(forResource: "OpenDyslexic-Regular", withExtension: "otf") else { return }
        CTFontManagerRegisterFontsForURL(fontURL as CFURL, .process, nil)
    }

    var body: some Scene {
        WindowGroup {
            ContentView()
                .environment(settings)
        }
    }
}
