import MetricKit
import OSLog

/// Receives MetricKit diagnostic payloads (crash reports, hangs, disk/memory warnings)
/// and logs them via os_log for Console.app visibility.
///
/// MetricKit delivers payloads at most once per day. Crash diagnostics include
/// stack traces, signal info, and exception details — all anonymized by Apple.
final class CrashDiagnosticsSubscriber: NSObject, MXMetricManagerSubscriber {

    static let shared = CrashDiagnosticsSubscriber()

    private static let log = Logger(
        subsystem: "com.chriscantu.SpeedReader",
        category: "CrashDiagnostics"
    )

    private override init() {
        super.init()
    }

    /// Register this subscriber with MetricKit. Call once at app launch.
    func register() {
        MXMetricManager.shared.add(self)
        Self.log.info("[SpeedReader:CrashDiagnostics] Subscriber registered")
    }

    // MARK: - MXMetricManagerSubscriber

    func didReceive(_ payloads: [MXMetricPayload]) {
        Self.log.info("[SpeedReader:CrashDiagnostics] Received \(payloads.count) metric payload(s)")
    }

    func didReceive(_ payloads: [MXDiagnosticPayload]) {
        for payload in payloads {
            if let crashDiagnostics = payload.crashDiagnostics {
                for crash in crashDiagnostics {
                    Self.log.error(
                        "[SpeedReader:CrashDiagnostics] Crash: \(crash.applicationVersion, privacy: .public) signal \(crash.signal?.description ?? "unknown", privacy: .public)"
                    )
                }
            }

            if let hangDiagnostics = payload.hangDiagnostics {
                Self.log.warning(
                    "[SpeedReader:CrashDiagnostics] \(hangDiagnostics.count) hang diagnostic(s) received"
                )
            }

            if let diskWriteExceptions = payload.diskWriteExceptionDiagnostics {
                Self.log.warning(
                    "[SpeedReader:CrashDiagnostics] \(diskWriteExceptions.count) disk write exception(s) received"
                )
            }
        }
    }
}
