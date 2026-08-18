import Foundation
import UIKit
import Security

public class IronFistIOS {
    private static let KeychainAccount = "ironfist_persistent_device_id"
    private static let KeychainService = "dev.ironfist.sdk"

    public static func collectTraits() -> [String: Any] {
        var traits: [String: Any] = [
            "os_platform": "ios",
            "os_version": UIDevice.current.systemVersion,
            "cpu_cores": ProcessInfo.processInfo.processorCount,
            "memory_gb": Int(ProcessInfo.processInfo.physicalMemory / (1024 * 1024 * 1024)),
            "keychain_id": getOrCreateKeychainID(),
            "gpu_renderer": "Apple Metal GPU",
            "screen_resolution": "\(Int(UIScreen.main.bounds.width))x\(Int(UIScreen.main.bounds.height))"
        ]
        
        if let idfv = UIDevice.current.identifierForVendor?.uuidString {
            traits["idfv"] = idfv
        }
        
        return traits
    }

    private static func getOrCreateKeychainID() -> String {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: KeychainService,
            kSecAttrAccount as String: KeychainAccount,
            kSecReturnData as String: true,
            kSecMatchLimit as String: kSecMatchLimitOne
        ]
        
        var dataTypeRef: AnyObject?
        let status = SecItemCopyMatching(query as CFDictionary, &dataTypeRef)
        
        if status == errSecSuccess, let data = dataTypeRef as? Data, let id = String(data: data, encoding: .utf8) {
            return id
        }
        
        let newID = UUID().uuidString
        if let data = newID.data(using: .utf8) {
            let addQuery: [String: Any] = [
                kSecClass as String: kSecClassGenericPassword,
                kSecAttrService as String: KeychainService,
                kSecAttrAccount as String: KeychainAccount,
                kSecValueData as String: data,
                kSecAttrAccessible as String: kSecAttrAccessibleAfterFirstUnlock
            ]
            SecItemAdd(addQuery as CFDictionary, nil)
        }
        
        return newID
    }
}
