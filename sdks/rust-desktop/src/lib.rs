//! IronFist desktop SDK.
//!
//! Use a PUBLISHABLE key (`if_pk_…`). Never embed a secret key in an app.
//!
//! ```no_run
//! let client = ironfist_desktop::Client::new("if_pk_…", "https://your-ironfist-url");
//! let result = client.verify("user_123", false).expect("verification request failed");
//! // Send result.verification_id to your server and confirm it there.
//! ```

use serde::{Deserialize, Serialize};
use std::process::Command;

/// Signals that identify this machine. Fields that could not be read are
/// omitted rather than guessed.
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct HardwareTraits {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub windows_guid: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub io_platform_uuid: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub machine_id: Option<String>,
    pub os_platform: String,
    pub cpu_cores: usize,
}

#[derive(Debug, Clone, Deserialize)]
pub struct VerifyResult {
    pub verification_id: Option<String>,
    pub decision: String,
    pub allowed: bool,
    pub reason: String,
    pub device_id: Option<String>,
}

#[derive(Debug)]
pub enum Error {
    /// The request never completed (DNS, TLS, timeout, …).
    Transport(String),
    /// IronFist answered with an error.
    Api { status: u16, message: String },
}

impl std::fmt::Display for Error {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Error::Transport(m) => write!(f, "IronFist request failed: {m}"),
            Error::Api { status, message } => write!(f, "IronFist error {status}: {message}"),
        }
    }
}

impl std::error::Error for Error {}

/// Reads this machine's stable identifiers.
pub fn collect_traits() -> HardwareTraits {
    let mut traits = HardwareTraits {
        os_platform: std::env::consts::OS.to_string(),
        cpu_cores: std::thread::available_parallelism().map(|n| n.get()).unwrap_or(1),
        ..Default::default()
    };

    if cfg!(target_os = "windows") {
        traits.windows_guid = windows_machine_guid();
    } else if cfg!(target_os = "macos") {
        traits.io_platform_uuid = macos_platform_uuid();
    } else {
        traits.machine_id = linux_machine_id();
    }
    traits
}

fn non_empty(s: &str) -> Option<String> {
    let s = s.trim().trim_matches('"').trim();
    if s.is_empty() {
        None
    } else {
        Some(s.to_string())
    }
}

/// `HKLM\SOFTWARE\Microsoft\Cryptography\MachineGuid`, set when Windows is installed.
fn windows_machine_guid() -> Option<String> {
    let output = Command::new("reg")
        .args(["query", r"HKLM\SOFTWARE\Microsoft\Cryptography", "/v", "MachineGuid"])
        .output()
        .ok()?;
    let stdout = String::from_utf8_lossy(&output.stdout);
    // The value line reads: "    MachineGuid    REG_SZ    <guid>"
    stdout
        .lines()
        .find(|l| l.contains("MachineGuid"))
        .and_then(|l| l.split_whitespace().last())
        .and_then(non_empty)
}

fn macos_platform_uuid() -> Option<String> {
    let output = Command::new("ioreg")
        .args(["-rd1", "-c", "IOPlatformExpertDevice"])
        .output()
        .ok()?;
    let stdout = String::from_utf8_lossy(&output.stdout);
    stdout
        .lines()
        .find(|l| l.contains("IOPlatformUUID"))
        .and_then(|l| l.split('=').nth(1))
        .and_then(non_empty)
}

fn linux_machine_id() -> Option<String> {
    ["/etc/machine-id", "/var/lib/dbus/machine-id"]
        .iter()
        .find_map(|path| std::fs::read_to_string(path).ok())
        .and_then(|s| non_empty(&s))
}

pub struct Client {
    api_key: String,
    base_url: String,
}

impl Client {
    pub fn new(api_key: impl Into<String>, base_url: impl Into<String>) -> Self {
        Self {
            api_key: api_key.into(),
            base_url: base_url.into().trim_end_matches('/').to_string(),
        }
    }

    /// Asks IronFist whether `account_id` may start a trial on this machine.
    /// Blocks until the request completes.
    pub fn verify(&self, account_id: &str, require_no_vpn: bool) -> Result<VerifyResult, Error> {
        let body = serde_json::json!({
            "account_id": account_id,
            "hardware_traits": collect_traits(),
            "require_no_vpn": require_no_vpn,
        });

        let response = ureq::post(&format!("{}/v1/verify", self.base_url))
            .set("Authorization", &format!("Bearer {}", self.api_key))
            .timeout(std::time::Duration::from_secs(10))
            .send_json(body);

        match response {
            Ok(res) => res.into_json::<VerifyResult>().map_err(|e| Error::Transport(e.to_string())),
            Err(ureq::Error::Status(status, res)) => {
                let value: serde_json::Value = res.into_json().unwrap_or(serde_json::Value::Null);
                // 429 carries a RATE_LIMITED decision in the same shape as a normal result.
                if status == 429 && value.get("decision").is_some() {
                    return serde_json::from_value(value).map_err(|e| Error::Transport(e.to_string()));
                }
                let message = value["error"]["message"].as_str().unwrap_or("request rejected").to_string();
                Err(Error::Api { status, message })
            }
            Err(e) => Err(Error::Transport(e.to_string())),
        }
    }
}
