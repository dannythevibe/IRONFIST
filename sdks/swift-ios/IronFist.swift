import Foundation
import Security
import UIKit

/// IronFist iOS SDK.
///
/// Use a PUBLISHABLE key (if_pk_…). Never embed a secret key in an app.
///
///     let ironfist = IronFist(apiKey: "if_pk_…", baseURL: URL(string: "https://your-ironfist-url")!)
///     let result = try await ironfist.verify(accountId: user.id)
///     // Send result.verificationId to your server and confirm it there.
public final class IronFist {
    private static let keychainAccount = "ironfist_persistent_device_id"
    private static let keychainService = "dev.ironfist.sdk"

    private let apiKey: String
    private let baseURL: URL
    private let session: URLSession

    public init(apiKey: String, baseURL: URL, session: URLSession = .shared) {
        self.apiKey = apiKey
        self.baseURL = baseURL
        self.session = session
    }

    public struct VerifyResult: Decodable {
        public let verificationId: String?
        public let decision: String
        public let allowed: Bool
        public let reason: String
        public let deviceId: String?

        enum CodingKeys: String, CodingKey {
            case verificationId = "verification_id"
            case decision, allowed, reason
            case deviceId = "device_id"
        }
    }

    public struct APIError: Error, LocalizedError {
        public let status: Int
        public let message: String
        public var errorDescription: String? { "IronFist error \(status): \(message)" }
    }

    /// Signals that identify this device. The Keychain identifier survives app
    /// reinstalls; the vendor identifier resets when all of your apps are removed.
    @MainActor
    public static func collectTraits() -> [String: Any] {
        let screen = UIScreen.main
        let scale = screen.scale
        var traits: [String: Any] = [
            "os_platform": "ios",
            "os_version": UIDevice.current.systemVersion,
            "cpu_cores": ProcessInfo.processInfo.processorCount,
            "memory_gb": Int((Double(ProcessInfo.processInfo.physicalMemory) / 1_073_741_824).rounded()),
            "screen_resolution": "\(Int(screen.bounds.width * scale))x\(Int(screen.bounds.height * scale))",
            "timezone": TimeZone.current.identifier,
            "language": Locale.preferredLanguages.first ?? "",
        ]
        if let keychainID = getOrCreateKeychainID() {
            traits["keychain_id"] = keychainID
        }
        if let idfv = UIDevice.current.identifierForVendor?.uuidString {
            traits["idfv"] = idfv
        }
        return traits
    }

    /// Asks IronFist whether `accountId` may start a trial on this device.
    public func verify(accountId: String, requireNoVPN: Bool = false) async throws -> VerifyResult {
        let traits = await IronFist.collectTraits()
        var request = URLRequest(url: baseURL.appendingPathComponent("v1/verify"))
        request.httpMethod = "POST"
        request.setValue("Bearer \(apiKey)", forHTTPHeaderField: "Authorization")
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try JSONSerialization.data(withJSONObject: [
            "account_id": accountId,
            "hardware_traits": traits,
            "require_no_vpn": requireNoVPN,
        ])

        let (data, response) = try await session.data(for: request)
        let status = (response as? HTTPURLResponse)?.statusCode ?? 0
        // 429 carries a RATE_LIMITED decision in the same shape as a normal result.
        if (200..<300).contains(status) || status == 429,
           let result = try? JSONDecoder().decode(VerifyResult.self, from: data) {
            return result
        }
        var message = "HTTP \(status)"
        if let object = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
           let error = object["error"] as? [String: Any],
           let text = error["message"] as? String {
            message = text
        }
        throw APIError(status: status, message: message)
    }

    private static func getOrCreateKeychainID() -> String? {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: keychainService,
            kSecAttrAccount as String: keychainAccount,
            kSecReturnData as String: true,
            kSecMatchLimit as String: kSecMatchLimitOne,
        ]
        var item: AnyObject?
        if SecItemCopyMatching(query as CFDictionary, &item) == errSecSuccess,
           let data = item as? Data,
           let id = String(data: data, encoding: .utf8) {
            return id
        }

        let newID = UUID().uuidString
        let add: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: keychainService,
            kSecAttrAccount as String: keychainAccount,
            kSecValueData as String: Data(newID.utf8),
            // Readable after first unlock, and never copied to another device by backup or sync.
            kSecAttrAccessible as String: kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly,
        ]
        // If the item cannot be stored, an identifier that changes on every launch
        // would register a new device each time, so report none instead.
        return SecItemAdd(add as CFDictionary, nil) == errSecSuccess ? newID : nil
    }
}
