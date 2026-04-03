import SwiftUI

@main
struct SpeedReaderApp: App {
    @State private var settings = ReaderSettings()

    var body: some Scene {
        WindowGroup {
            ContentView()
                .environment(settings)
        }
    }
}
