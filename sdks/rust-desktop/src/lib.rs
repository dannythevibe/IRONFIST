use serde::{Deserialize, Serialize};
use std::process::Command;

#[derive(Debug, Serialize, Deserialize, Default)]
pub struct HardwareTraits {
    pub keychain_id: Option<String>,
    pub windows_guid: Option<String>,
    pub io_platform_uuid: Option<String>,
    pub smbios_serial: Option<String>,
    pub linux_machine_id: Option<String>,
    pub os_platform: String,
    pub os_arch: String,
    pub os_version: String,
    pub cpu_cores: usize,
    pub memory_gb: usize,
}

pub struct IronFistDesktopExtractor;

impl IronFistDesktopExtractor {
    pub fn collect_traits() -> HardwareTraits {
        let mut traits = HardwareTraits {
            os_platform: std::env::consts::OS.to_string(),
            os_arch: std::env::consts::ARCH.to_string(),
            cpu_cores: num_cpus(),
            memory_gb: 16, // Default fallback
            ..Default::default()
        };

        #[cfg(target_os = "windows")]
        {
            if let Ok(output) = Command::new("powershell")
                .args(["-Command", "(Get-ItemProperty -Path 'HKLM:\\SOFTWARE\\Microsoft\\Cryptography').MachineGuid"])
                .output()
            {
                let guid = String::from_utf8_lossy(&output.stdout).trim().to_string();
                if !guid.is_empty() {
                    traits.windows_guid = Some(guid);
                }
            }
        }

        #[cfg(target_os = "macos")]
        {
            if let Ok(output) = Command::new("ioreg")
                .args(["-rd1", "-c", "IOPlatformExpertDevice"])
                .output()
            {
                let stdout = String::from_utf8_lossy(&output.stdout);
                for line in stdout.lines() {
                    if line.contains("IOPlatformUUID") {
                        let uuid = line.split('=').nth(1).unwrap_or("").trim().replace("\"", "");
                        traits.io_platform_uuid = Some(uuid);
                    }
                    if line.contains("IOPlatformSerialNumber") {
                        let serial = line.split('=').nth(1).unwrap_or("").trim().replace("\"", "");
                        traits.smbios_serial = Some(serial);
                    }
                }
            }
        }

        #[cfg(target_os = "linux")]
        {
            if let Ok(id) = std::fs::read_to_string("/etc/machine-id") {
                let trimmed = id.trim().to_string();
                if !trimmed.is_empty() {
                    traits.linux_machine_id = Some(trimmed);
                }
            } else if let Ok(id) = std::fs::read_to_string("/var/lib/dbus/machine-id") {
                let trimmed = id.trim().to_string();
                if !trimmed.is_empty() {
                    traits.linux_machine_id = Some(trimmed);
                }
            }
        }

        traits
    }
}

fn num_cpus() -> usize {
    std::thread::available_parallelism().map(|n| n.get()).unwrap_or(4)
}
