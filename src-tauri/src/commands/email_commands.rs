use serde::{Deserialize, Serialize};
use native_tls::TlsConnector;
use std::fs;
use std::io::{Read, Write};
use std::net::TcpStream;
use std::path::PathBuf;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct EmailMessage {
    pub id: String,
    pub uid: u32,
    pub from: String,
    pub to: String,
    pub subject: String,
    pub date: String,
    pub body_text: Option<String>,
    pub body_html: Option<String>,
    pub attachments: Vec<String>,
    pub flags: Vec<String>,
    pub folder: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ImapAccount {
    pub email: String,
    pub password: String,
    pub imap_host: String,
    pub imap_port: u16,
    pub protocol: Option<String>, // "imap" or "pop3"
}

/// Connect to IMAP or POP3 server and sync emails (with TLS support)
#[tauri::command]
pub fn imap_sync(
    account: ImapAccount,
    vault_path: String,
    folder: String,
    max_emails: u32,
) -> Result<Vec<EmailMessage>, String> {
    let host = &account.imap_host;
    let port = account.imap_port;
    let email = &account.email;
    let password = &account.password;
    let protocol = account.protocol.as_deref().unwrap_or("imap");

    // Determine if we need TLS (port 993/995 typically means SSL)
    let use_tls = port == 993 || port == 995;

    // Route to IMAP or POP3 based on protocol
    if protocol == "pop3" {
        if use_tls {
            pop3_sync_tls(host, port, email, password, &vault_path, max_emails)
        } else {
            pop3_sync_plain(host, port, email, password, &vault_path, max_emails)
        }
    } else {
        // IMAP
        if use_tls {
            imap_sync_tls(host, port, email, password, &vault_path, &folder, max_emails)
        } else {
            imap_sync_plain(host, port, email, password, &vault_path, &folder, max_emails)
        }
    }
}

fn imap_sync_tls(
    host: &str,
    port: u16,
    email: &str,
    password: &str,
    vault_path: &str,
    folder: &str,
    max_emails: u32,
) -> Result<Vec<EmailMessage>, String> {
    use native_tls::TlsStream;

    // Create TLS connector
    let connector = TlsConnector::builder()
        .danger_accept_invalid_certs(true) // For testing - remove in production
        .build()
        .map_err(|e| format!("TLS 创建失败: {}", e))?;

    // Connect to IMAP server
    let addr = format!("{}:{}", host, port);
    let tcp_stream = TcpStream::connect(&addr).map_err(|e| format!("连接失败: {}", e))?;
    tcp_stream.set_read_timeout(Some(std::time::Duration::from_secs(30))).ok();

    // Upgrade to TLS
    let tls_stream = connector.connect(host, tcp_stream)
        .map_err(|e| format!("TLS 握手失败: {}", e))?;

    let mut stream: TlsStream<TcpStream> = tls_stream;

    // Read greeting
    read_response(&mut stream)?;

    // Login
    let login_cmd = format!("A01 LOGIN {} {}\r\n", email, password);
    stream.write_all(login_cmd.as_bytes()).map_err(|e| format!("发送失败: {}", e))?;
    let login_resp = read_response(&mut stream)?;
    if !login_resp.contains("A01 OK") {
        return Err(format!("登录失败: {}", login_resp));
    }

    // Select folder
    let select_cmd = format!("A02 SELECT {}\r\n", folder);
    stream.write_all(select_cmd.as_bytes()).map_err(|e| format!("发送失败: {}", e))?;
    let select_resp = read_response(&mut stream)?;
    if !select_resp.contains("A02 OK") {
        return Err(format!("选择文件夹失败: {}", select_resp));
    }

    // Get message count
    let message_count = parse_message_count(&select_resp);
    let fetch_count = std::cmp::min(max_emails as usize, message_count);

    if fetch_count == 0 {
        stream.write_all(b"A03 LOGOUT\r\n").ok();
        return Ok(Vec::new());
    }

    // Fetch envelopes
    let fetch_cmd = format!("A04 FETCH 1:{} (ENVELOPE UID FLAGS)\r\n", fetch_count);
    stream.write_all(fetch_cmd.as_bytes()).map_err(|e| format!("发送失败: {}", e))?;

    // Read response
    let mut response = Vec::new();
    let mut buf = [0u8; 8192];
    loop {
        match stream.read(&mut buf) {
            Ok(0) => break,
            Ok(n) => {
                response.extend_from_slice(&buf[..n]);
                let resp_str = String::from_utf8_lossy(&response);
                if resp_str.contains("A04 OK") {
                    break;
                }
            }
            Err(e) => {
                // For timeout or other errors, break if we have some data
                if response.len() > 100 {
                    break;
                }
                return Err(format!("读取失败: {}", e));
            }
        }
    }

    let resp_str = String::from_utf8_lossy(&response);

    // Parse emails from response
    let emails = parse_envelope_response(&resp_str, folder);

    // Logout
    stream.write_all(b"A05 LOGOUT\r\n").ok();

    // Save to vault
    let emails_dir = PathBuf::from(vault_path).join(".lifeos/emails").join(folder);
    fs::create_dir_all(&emails_dir).map_err(|e| format!("创建目录失败: {}", e))?;

    let index_path = emails_dir.join("index.json");
    let index_json = serde_json::to_string_pretty(&emails).map_err(|e| e.to_string())?;
    fs::write(&index_path, index_json).map_err(|e| format!("写入文件失败: {}", e))?;

    Ok(emails)
}

fn imap_sync_plain(
    host: &str,
    port: u16,
    email: &str,
    password: &str,
    vault_path: &str,
    folder: &str,
    max_emails: u32,
) -> Result<Vec<EmailMessage>, String> {
    // Connect to IMAP server
    let addr = format!("{}:{}", host, port);
    let mut stream = TcpStream::connect(&addr).map_err(|e| format!("连接失败: {}", e))?;
    stream.set_read_timeout(Some(std::time::Duration::from_secs(30))).ok();

    // Read greeting
    let mut buf = [0u8; 1024];
    let _n = stream.read(&mut buf).map_err(|e| format!("读取失败: {}", e))?;

    // Login
    let login_cmd = format!("A01 LOGIN {} {}\r\n", email, password);
    stream.write_all(login_cmd.as_bytes()).map_err(|e| format!("发送失败: {}", e))?;
    let mut buf = [0u8; 4096];
    let n = stream.read(&mut buf).map_err(|e| format!("读取失败: {}", e))?;
    let login_resp = String::from_utf8_lossy(&buf[..n]);
    if !login_resp.contains("A01 OK") {
        return Err(format!("登录失败: {}", login_resp));
    }

    // Select folder
    let select_cmd = format!("A02 SELECT {}\r\n", folder);
    stream.write_all(select_cmd.as_bytes()).map_err(|e| format!("发送失败: {}", e))?;
    let n = stream.read(&mut buf).map_err(|e| format!("读取失败: {}", e))?;
    let select_resp = String::from_utf8_lossy(&buf[..n]);
    if !select_resp.contains("A02 OK") {
        return Err(format!("选择文件夹失败: {}", select_resp));
    }

    // Get message count
    let message_count = parse_message_count(&select_resp);
    let fetch_count = std::cmp::min(max_emails as usize, message_count);

    if fetch_count == 0 {
        stream.write_all(b"A03 LOGOUT\r\n").ok();
        return Ok(Vec::new());
    }

    // Fetch envelopes
    let fetch_cmd = format!("A04 FETCH 1:{} (ENVELOPE UID FLAGS)\r\n", fetch_count);
    stream.write_all(fetch_cmd.as_bytes()).map_err(|e| format!("发送失败: {}", e))?;

    // Read response
    let mut response = Vec::new();
    loop {
        match stream.read(&mut buf) {
            Ok(0) => break,
            Ok(n) => {
                response.extend_from_slice(&buf[..n]);
                let resp_str = String::from_utf8_lossy(&response);
                if resp_str.contains("A04 OK") {
                    break;
                }
            }
            Err(e) => {
                if response.len() > 100 {
                    break;
                }
                return Err(format!("读取失败: {}", e));
            }
        }
    }

    let resp_str = String::from_utf8_lossy(&response);

    // Parse emails from response
    let emails = parse_envelope_response(&resp_str, folder);

    // Logout
    stream.write_all(b"A05 LOGOUT\r\n").ok();

    // Save to vault
    let emails_dir = PathBuf::from(vault_path).join(".lifeos/emails").join(folder);
    fs::create_dir_all(&emails_dir).map_err(|e| format!("创建目录失败: {}", e))?;

    let index_path = emails_dir.join("index.json");
    let index_json = serde_json::to_string_pretty(&emails).map_err(|e| e.to_string())?;
    fs::write(&index_path, index_json).map_err(|e| format!("写入文件失败: {}", e))?;

    Ok(emails)
}

// ── POP3 support ─────────────────────────────────────────────────────────────────

fn pop3_sync_tls(
    host: &str,
    port: u16,
    email: &str,
    password: &str,
    vault_path: &str,
    max_emails: u32,
) -> Result<Vec<EmailMessage>, String> {
    use native_tls::TlsStream;

    // Create TLS connector
    let connector = TlsConnector::builder()
        .danger_accept_invalid_certs(true)
        .build()
        .map_err(|e| format!("TLS 创建失败: {}", e))?;

    // Connect to POP3 server
    let addr = format!("{}:{}", host, port);
    let tcp_stream = TcpStream::connect(&addr).map_err(|e| format!("连接失败: {}", e))?;
    tcp_stream.set_read_timeout(Some(std::time::Duration::from_secs(30))).ok();

    // Upgrade to TLS
    let tls_stream = connector.connect(host, tcp_stream)
        .map_err(|e| format!("TLS 握手失败: {}", e))?;

    let mut stream: TlsStream<TcpStream> = tls_stream;

    // Read greeting
    read_response(&mut stream)?;

    // Login
    let user_cmd = format!("USER {}\r\n", email);
    stream.write_all(user_cmd.as_bytes()).map_err(|e| format!("发送失败: {}", e))?;
    let user_resp = read_response(&mut stream)?;
    if !user_resp.contains("+OK") {
        return Err(format!("USER 命令失败: {}", user_resp));
    }

    let pass_cmd = format!("PASS {}\r\n", password);
    stream.write_all(pass_cmd.as_bytes()).map_err(|e| format!("发送失败: {}", e))?;
    let pass_resp = read_response(&mut stream)?;
    if !pass_resp.contains("+OK") {
        return Err(format!("登录失败: {}", pass_resp));
    }

    // Get email count
    let stat_cmd = "STAT\r\n".to_string();
    stream.write_all(stat_cmd.as_bytes()).map_err(|e| format!("发送失败: {}", e))?;
    let stat_resp = read_response(&mut stream)?;

    // Parse message count from STAT response: +OK n s
    let message_count = stat_resp
        .split_whitespace()
        .nth(1)
        .and_then(|n| n.parse().ok())
        .unwrap_or(0);

    let fetch_count = std::cmp::min(max_emails as usize, message_count);

    if fetch_count == 0 {
        stream.write_all(b"QUIT\r\n").ok();
        return Ok(Vec::new());
    }

    // Fetch emails
    let mut emails = Vec::new();
    for i in 1..=fetch_count {
        let retr_cmd = format!("RETR {}\r\n", i);
        stream.write_all(retr_cmd.as_bytes()).map_err(|e| format!("发送失败: {}", e))?;

        // Read multi-line response
        let mut response = Vec::new();
        let mut buf = [0u8; 8192];
        loop {
            match stream.read(&mut buf) {
                Ok(0) => break,
                Ok(n) => {
                    response.extend_from_slice(&buf[..n]);
                    let resp_str = String::from_utf8_lossy(&response);
                    if resp_str.contains("\r\n.\r\n") || resp_str.contains("\n.\n") {
                        break;
                    }
                }
                Err(_) => break,
            }
        }

        let resp_str = String::from_utf8_lossy(&response);
        let email_msg = parse_pop3_email(&resp_str, "INBOX");
        emails.push(email_msg);
    }

    // Logout
    stream.write_all(b"QUIT\r\n").ok();

    // Save to vault
    let emails_dir = PathBuf::from(vault_path).join(".lifeos/emails").join("INBOX");
    fs::create_dir_all(&emails_dir).map_err(|e| format!("创建目录失败: {}", e))?;

    let index_path = emails_dir.join("index.json");
    let index_json = serde_json::to_string_pretty(&emails).map_err(|e| e.to_string())?;
    fs::write(&index_path, index_json).map_err(|e| format!("写入文件失败: {}", e))?;

    Ok(emails)
}

fn pop3_sync_plain(
    host: &str,
    port: u16,
    email: &str,
    password: &str,
    vault_path: &str,
    max_emails: u32,
) -> Result<Vec<EmailMessage>, String> {
    // Connect to POP3 server
    let addr = format!("{}:{}", host, port);
    let mut stream = TcpStream::connect(&addr).map_err(|e| format!("连接失败: {}", e))?;
    stream.set_read_timeout(Some(std::time::Duration::from_secs(30))).ok();

    // Read greeting
    let mut buf = [0u8; 1024];
    let _n = stream.read(&mut buf).map_err(|e| format!("读取失败: {}", e))?;

    // Login
    let user_cmd = format!("USER {}\r\n", email);
    stream.write_all(user_cmd.as_bytes()).map_err(|e| format!("发送失败: {}", e))?;
    let mut buf = [0u8; 4096];
    let n = stream.read(&mut buf).map_err(|e| format!("读取失败: {}", e))?;
    let user_resp = String::from_utf8_lossy(&buf[..n]);
    if !user_resp.contains("+OK") {
        return Err(format!("USER 命令失败: {}", user_resp));
    }

    let pass_cmd = format!("PASS {}\r\n", password);
    stream.write_all(pass_cmd.as_bytes()).map_err(|e| format!("发送失败: {}", e))?;
    let n = stream.read(&mut buf).map_err(|e| format!("读取失败: {}", e))?;
    let pass_resp = String::from_utf8_lossy(&buf[..n]);
    if !pass_resp.contains("+OK") {
        return Err(format!("登录失败: {}", pass_resp));
    }

    // Get email count
    let stat_cmd = "STAT\r\n".to_string();
    stream.write_all(stat_cmd.as_bytes()).map_err(|e| format!("发送失败: {}", e))?;
    let n = stream.read(&mut buf).map_err(|e| format!("读取失败: {}", e))?;
    let stat_resp = String::from_utf8_lossy(&buf[..n]);

    let message_count = stat_resp
        .split_whitespace()
        .nth(1)
        .and_then(|n| n.parse().ok())
        .unwrap_or(0);

    let fetch_count = std::cmp::min(max_emails as usize, message_count);

    if fetch_count == 0 {
        stream.write_all(b"QUIT\r\n").ok();
        return Ok(Vec::new());
    }

    // Fetch emails
    let mut emails = Vec::new();
    for i in 1..=fetch_count {
        let retr_cmd = format!("RETR {}\r\n", i);
        stream.write_all(retr_cmd.as_bytes()).map_err(|e| format!("发送失败: {}", e))?;

        let mut response = Vec::new();
        loop {
            match stream.read(&mut buf) {
                Ok(0) => break,
                Ok(n) => {
                    response.extend_from_slice(&buf[..n]);
                    let resp_str = String::from_utf8_lossy(&response);
                    if resp_str.contains("\r\n.\r\n") || resp_str.contains("\n.\n") {
                        break;
                    }
                }
                Err(_) => break,
            }
        }

        let resp_str = String::from_utf8_lossy(&response);
        let email_msg = parse_pop3_email(&resp_str, "INBOX");
        emails.push(email_msg);
    }

    // Logout
    stream.write_all(b"QUIT\r\n").ok();

    // Save to vault
    let emails_dir = PathBuf::from(vault_path).join(".lifeos/emails").join("INBOX");
    fs::create_dir_all(&emails_dir).map_err(|e| format!("创建目录失败: {}", e))?;

    let index_path = emails_dir.join("index.json");
    let index_json = serde_json::to_string_pretty(&emails).map_err(|e| e.to_string())?;
    fs::write(&index_path, index_json).map_err(|e| format!("写入文件失败: {}", e))?;

    Ok(emails)
}

fn parse_pop3_email(response: &str, folder: &str) -> EmailMessage {
    let mut from = String::new();
    let mut to = String::new();
    let mut subject = String::new();
    let mut date = String::new();

    for line in response.lines() {
        if line.starts_with("From:") || line.starts_with("From ") {
            from = extract_pop3_header(line);
        } else if line.starts_with("To:") || line.starts_with("To ") {
            to = extract_pop3_header(line);
        } else if line.starts_with("Subject:") || line.starts_with("Subject ") {
            subject = line.replace("Subject:", "").replace("Subject", "").trim().to_string();
        } else if line.starts_with("Date:") || line.starts_with("Date ") {
            date = line.replace("Date:", "").replace("Date", "").trim().to_string();
        }
    }

    EmailMessage {
        id: format!("{}_{}", folder, 1),
        uid: 1,
        from,
        to,
        subject,
        date,
        body_text: None,
        body_html: None,
        attachments: vec![],
        flags: vec![],
        folder: folder.to_string(),
    }
}

fn extract_pop3_header(line: &str) -> String {
    let parts: Vec<&str> = line.splitn(2, ':').collect();
    if parts.len() > 1 {
        parts[1].trim().to_string()
    } else {
        line.replace("From", "").replace("To", "").trim().to_string()
    }
}

fn read_response<T: Read>(stream: &mut T) -> Result<String, String> {
    let mut buf = [0u8; 4096];
    let n = stream.read(&mut buf).map_err(|e| format!("读取失败: {}", e))?;
    Ok(String::from_utf8_lossy(&buf[..n]).to_string())
}

fn parse_message_count(response: &str) -> usize {
    for part in response.split(',') {
        if part.contains("EXISTS") {
            if let Some(num) = part.split_whitespace().next() {
                return num.parse().unwrap_or(0);
            }
        }
    }
    0
}

fn parse_envelope_response(response: &str, folder: &str) -> Vec<EmailMessage> {
    let mut emails = Vec::new();
    let lines: Vec<&str> = response.lines().collect();

    for (i, line) in lines.iter().enumerate() {
        if line.contains("ENVELOPE") {
            let from = extract_address(&lines, i, "From");
            let to = extract_address(&lines, i, "To");
            let subject = extract_subject(&lines, i);

            emails.push(EmailMessage {
                id: format!("{}_{}", folder, emails.len() + 1),
                uid: (emails.len() + 1) as u32,
                from,
                to,
                subject,
                date: String::new(),
                body_text: None,
                body_html: None,
                attachments: vec![],
                flags: vec![],
                folder: folder.to_string(),
            });
        }
    }

    emails
}

fn extract_address(lines: &[&str], start: usize, _field: &str) -> String {
    for i in start..std::cmp::min(start + 20, lines.len()) {
        let line = lines[i];
        if line.contains("From") || line.contains("To") {
            if let Some(start) = line.find('<') {
                if let Some(end) = line.find('>') {
                    return line[start+1..end].to_string();
                }
            }
        }
    }
    String::new()
}

fn extract_subject(lines: &[&str], start: usize) -> String {
    for i in start..std::cmp::min(start + 20, lines.len()) {
        let line = lines[i];
        if line.contains("Subject") || line.contains("件") {
            return line.replace("\"", "").trim().to_string();
        }
    }
    String::new()
}

/// Get emails from local cache
#[tauri::command]
pub fn get_cached_emails(vault_path: String, folder: String) -> Result<Vec<EmailMessage>, String> {
    let index_path = PathBuf::from(&vault_path)
        .join(".lifeos/emails")
        .join(&folder)
        .join("index.json");

    if !index_path.exists() {
        return Ok(Vec::new());
    }

    let content = fs::read_to_string(&index_path).map_err(|e| format!("读取失败: {}", e))?;
    let emails: Vec<EmailMessage> = serde_json::from_str(&content).map_err(|e| format!("解析失败: {}", e))?;

    Ok(emails)
}

/// List available email folders
#[tauri::command]
pub fn list_email_folders(vault_path: String) -> Result<Vec<String>, String> {
    let emails_dir = PathBuf::from(&vault_path).join(".lifeos/emails");

    if !emails_dir.exists() {
        return Ok(vec![
            "INBOX".to_string(),
            "Sent".to_string(),
            "Drafts".to_string(),
            "Trash".to_string(),
            "Archive".to_string(),
        ]);
    }

    let mut folders = Vec::new();
    if let Ok(entries) = fs::read_dir(&emails_dir) {
        for entry in entries.flatten() {
            if entry.file_type().map(|ft| ft.is_dir()).unwrap_or(false) {
                folders.push(entry.file_name().to_string_lossy().to_string());
            }
        }
    }

    if folders.is_empty() {
        folders = vec![
            "INBOX".to_string(),
            "Sent".to_string(),
            "Drafts".to_string(),
            "Trash".to_string(),
            "Archive".to_string(),
        ];
    }

    Ok(folders)
}
