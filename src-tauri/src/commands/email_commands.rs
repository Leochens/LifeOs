use serde::{Deserialize, Serialize};
use native_tls::TlsConnector;
use std::fs;
use std::io::{Read, Write};
use std::net::TcpStream;
use std::path::PathBuf;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct EmailMessage {
    #[serde(rename = "id")]
    pub id: String,
    #[serde(rename = "uid")]
    pub uid: u32,
    #[serde(rename = "from")]
    pub from: String,
    #[serde(rename = "to")]
    pub to: String,
    #[serde(rename = "subject")]
    pub subject: String,
    #[serde(rename = "date")]
    pub date: String,
    #[serde(rename = "bodyText")]
    pub body_text: Option<String>,
    #[serde(rename = "bodyHtml")]
    pub body_html: Option<String>,
    #[serde(rename = "attachments")]
    pub attachments: Vec<String>,
    #[serde(rename = "flags")]
    pub flags: Vec<String>,
    #[serde(rename = "folder")]
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
        // IMAP — use the `imap` crate for reliable parsing
        imap_sync_with_crate(host, port, email, password, &vault_path, &folder, max_emails, use_tls)
    }
}

// ── IMAP via `imap` crate + `mail-parser` ────────────────────────────────────

fn imap_sync_with_crate(
    host: &str,
    port: u16,
    email: &str,
    password: &str,
    vault_path: &str,
    folder: &str,
    max_emails: u32,
    use_tls: bool,
) -> Result<Vec<EmailMessage>, String> {
    let tls = native_tls::TlsConnector::builder()
        .danger_accept_invalid_certs(true)
        .build()
        .map_err(|e| format!("TLS 创建失败: {}", e))?;

    // Connect
    let client = if use_tls {
        imap::connect((host, port), host, &tls)
            .map_err(|e| format!("IMAP 连接失败: {}", e))?
    } else {
        let stream = TcpStream::connect((host, port))
            .map_err(|e| format!("连接失败: {}", e))?;
        imap::Client::new(stream)
            .secure(host, &tls)
            .map_err(|e| format!("STARTTLS 失败: {}", e))?
    };

    // Login
    let mut session = client
        .login(email, password)
        .map_err(|e| format!("登录失败: {}", e.0))?;

    // Select mailbox
    let mailbox = session
        .select(folder)
        .map_err(|e| format!("选择文件夹失败: {}", e))?;

    let total = mailbox.exists as u32;
    if total == 0 {
        session.logout().ok();
        return Ok(Vec::new());
    }

    // Fetch the latest N emails (from newest to oldest)
    let fetch_count = std::cmp::min(max_emails, total);
    let start = total.saturating_sub(fetch_count) + 1;
    let range = format!("{}:{}", start, total);

    // Fetch envelope + full body (BODY[] returns complete message)
    let messages = session
        .fetch(&range, "(UID FLAGS ENVELOPE BODY[])")
        .map_err(|e| format!("拉取邮件失败: {}", e))?;

    let mut emails = Vec::new();

    for msg in messages.iter() {
        let uid = msg.uid.unwrap_or(0);

        // Parse envelope for metadata
        let (subject, from, to, date) = if let Some(env) = msg.envelope() {
            let subject = env
                .subject
                .as_ref()
                .map(|s| {
                    // Try to decode RFC2047 encoded subject
                    let s_str = String::from_utf8_lossy(s).to_string();
                    decode_mime_header(&s_str)
                })
                .unwrap_or_default();

            let from = env
                .from
                .as_ref()
                .and_then(|addrs| addrs.first())
                .map(|a| {
                    let mailbox = a.mailbox.as_ref().map(|m| String::from_utf8_lossy(m).to_string()).unwrap_or_default();
                    let host = a.host.as_ref().map(|h| String::from_utf8_lossy(h).to_string()).unwrap_or_default();
                    let name = a.name.as_ref().map(|n| {
                        let n_str = String::from_utf8_lossy(n).to_string();
                        decode_mime_header(&n_str)
                    });
                    if let Some(name) = name {
                        format!("{} <{}@{}>", name, mailbox, host)
                    } else {
                        format!("{}@{}", mailbox, host)
                    }
                })
                .unwrap_or_default();

            let to = env
                .to
                .as_ref()
                .and_then(|addrs| addrs.first())
                .map(|a| {
                    let mailbox = a.mailbox.as_ref().map(|m| String::from_utf8_lossy(m).to_string()).unwrap_or_default();
                    let host = a.host.as_ref().map(|h| String::from_utf8_lossy(h).to_string()).unwrap_or_default();
                    format!("{}@{}", mailbox, host)
                })
                .unwrap_or_default();

            let date = env
                .date
                .as_ref()
                .map(|d| String::from_utf8_lossy(d).to_string())
                .unwrap_or_default();

            (subject, from, to, date)
        } else {
            (String::new(), String::new(), String::new(), String::new())
        };

        // Parse full message body with mail-parser
        let (body_text, body_html) = if let Some(body) = msg.body() {
            parse_email_body(body)
        } else {
            (None, None)
        };

        // Parse flags
        let flags: Vec<String> = msg
            .flags()
            .iter()
            .map(|f| format!("{:?}", f))
            .collect();

        emails.push(EmailMessage {
            id: format!("{}_{}", folder, uid),
            uid,
            from,
            to,
            subject,
            date,
            body_text,
            body_html,
            attachments: vec![],
            flags,
            folder: folder.to_string(),
        });
    }

    // Reverse so newest is first
    emails.reverse();

    // Logout
    session.logout().ok();

    // Save to vault cache
    let emails_dir = PathBuf::from(vault_path).join(".lifeos/emails").join(folder);
    fs::create_dir_all(&emails_dir).map_err(|e| format!("创建目录失败: {}", e))?;

    let index_path = emails_dir.join("index.json");
    let index_json = serde_json::to_string_pretty(&emails).map_err(|e| e.to_string())?;
    fs::write(&index_path, index_json).map_err(|e| format!("写入文件失败: {}", e))?;

    Ok(emails)
}

/// Parse email body using mail-parser to extract text and HTML parts
fn parse_email_body(raw: &[u8]) -> (Option<String>, Option<String>) {
    use mail_parser::MessageParser;

    let parser = MessageParser::default();
    if let Some(message) = parser.parse(raw) {
        let body_text = message.body_text(0).map(|t| t.to_string());
        let body_html = message.body_html(0).map(|h| h.to_string());
        (body_text, body_html)
    } else {
        // Fallback: treat as plain text
        let text = String::from_utf8_lossy(raw).to_string();
        (Some(text), None)
    }
}

/// Decode RFC2047 MIME encoded-word headers (=?charset?encoding?text?=)
fn decode_mime_header(input: &str) -> String {
    if !input.contains("=?") {
        return input.to_string();
    }

    let mut result = input.to_string();

    // Simple RFC2047 decoder for common cases
    while let Some(start) = result.find("=?") {
        if let Some(end) = result[start + 2..].find("?=") {
            let encoded = &result[start + 2..start + 2 + end];
            let parts: Vec<&str> = encoded.splitn(3, '?').collect();
            if parts.len() == 3 {
                let charset = parts[0];
                let encoding = parts[1].to_uppercase();
                let text = parts[2];

                let decoded_bytes = if encoding == "B" {
                    // Base64
                    base64::Engine::decode(&base64::engine::general_purpose::STANDARD, text).ok()
                } else if encoding == "Q" {
                    // Quoted-printable
                    decode_quoted_printable_header(text)
                } else {
                    None
                };

                if let Some(bytes) = decoded_bytes {
                    let decoded = if charset.eq_ignore_ascii_case("utf-8") || charset.eq_ignore_ascii_case("utf8") {
                        String::from_utf8_lossy(&bytes).to_string()
                    } else if charset.eq_ignore_ascii_case("gb2312") || charset.eq_ignore_ascii_case("gbk") || charset.eq_ignore_ascii_case("gb18030") {
                        // For GBK/GB2312, try UTF-8 first (many are actually UTF-8)
                        String::from_utf8(bytes.clone())
                            .unwrap_or_else(|_| String::from_utf8_lossy(&bytes).to_string())
                    } else {
                        String::from_utf8_lossy(&bytes).to_string()
                    };
                    result = format!("{}{}{}", &result[..start], decoded, &result[start + 2 + end + 2..]);
                    continue;
                }
            }
            // If decoding failed, skip this token
            break;
        } else {
            break;
        }
    }

    result.trim().to_string()
}

fn decode_quoted_printable_header(input: &str) -> Option<Vec<u8>> {
    let mut result = Vec::new();
    let bytes = input.as_bytes();
    let mut i = 0;
    while i < bytes.len() {
        if bytes[i] == b'=' && i + 2 < bytes.len() {
            if let Ok(byte) = u8::from_str_radix(&input[i + 1..i + 3], 16) {
                result.push(byte);
                i += 3;
                continue;
            }
        }
        if bytes[i] == b'_' {
            result.push(b' ');
        } else {
            result.push(bytes[i]);
        }
        i += 1;
    }
    Some(result)
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

    let connector = TlsConnector::builder()
        .danger_accept_invalid_certs(true)
        .build()
        .map_err(|e| format!("TLS 创建失败: {}", e))?;

    let addr = format!("{}:{}", host, port);
    let tcp_stream = TcpStream::connect(&addr).map_err(|e| format!("连接失败: {}", e))?;
    tcp_stream.set_read_timeout(Some(std::time::Duration::from_secs(30))).ok();

    let tls_stream = connector.connect(host, tcp_stream)
        .map_err(|e| format!("TLS 握手失败: {}", e))?;

    let mut stream: TlsStream<TcpStream> = tls_stream;

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
    stream.write_all(b"STAT\r\n").map_err(|e| format!("发送失败: {}", e))?;
    let stat_resp = read_response(&mut stream)?;
    let message_count: usize = stat_resp
        .split_whitespace()
        .nth(1)
        .and_then(|n| n.parse().ok())
        .unwrap_or(0);

    let fetch_count = std::cmp::min(max_emails as usize, message_count);

    if fetch_count == 0 {
        stream.write_all(b"QUIT\r\n").ok();
        return Ok(Vec::new());
    }

    // Fetch emails (from newest)
    let mut emails = Vec::new();
    let start = if message_count > fetch_count { message_count - fetch_count + 1 } else { 1 };
    for i in (start..=message_count).rev() {
        let retr_cmd = format!("RETR {}\r\n", i);
        stream.write_all(retr_cmd.as_bytes()).map_err(|e| format!("发送失败: {}", e))?;

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

        // Strip POP3 +OK header line, then parse with mail-parser
        let resp_str = String::from_utf8_lossy(&response);
        let raw_email = if let Some(idx) = resp_str.find("\r\n") {
            &response[idx + 2..]
        } else {
            &response[..]
        };

        let email_msg = parse_pop3_email_with_parser(raw_email, "INBOX", i as u32);
        emails.push(email_msg);
    }

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
    let addr = format!("{}:{}", host, port);
    let mut stream = TcpStream::connect(&addr).map_err(|e| format!("连接失败: {}", e))?;
    stream.set_read_timeout(Some(std::time::Duration::from_secs(30))).ok();

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

    stream.write_all(b"STAT\r\n").map_err(|e| format!("发送失败: {}", e))?;
    let n = stream.read(&mut buf).map_err(|e| format!("读取失败: {}", e))?;
    let stat_resp = String::from_utf8_lossy(&buf[..n]);
    let message_count: usize = stat_resp
        .split_whitespace()
        .nth(1)
        .and_then(|n| n.parse().ok())
        .unwrap_or(0);

    let fetch_count = std::cmp::min(max_emails as usize, message_count);

    if fetch_count == 0 {
        stream.write_all(b"QUIT\r\n").ok();
        return Ok(Vec::new());
    }

    let mut emails = Vec::new();
    let start = if message_count > fetch_count { message_count - fetch_count + 1 } else { 1 };
    for i in (start..=message_count).rev() {
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
        let raw_email = if let Some(idx) = resp_str.find("\r\n") {
            &response[idx + 2..]
        } else {
            &response[..]
        };

        let email_msg = parse_pop3_email_with_parser(raw_email, "INBOX", i as u32);
        emails.push(email_msg);
    }

    stream.write_all(b"QUIT\r\n").ok();

    let emails_dir = PathBuf::from(vault_path).join(".lifeos/emails").join("INBOX");
    fs::create_dir_all(&emails_dir).map_err(|e| format!("创建目录失败: {}", e))?;
    let index_path = emails_dir.join("index.json");
    let index_json = serde_json::to_string_pretty(&emails).map_err(|e| e.to_string())?;
    fs::write(&index_path, index_json).map_err(|e| format!("写入文件失败: {}", e))?;

    Ok(emails)
}

/// Parse a POP3 email using mail-parser for proper MIME handling
fn parse_pop3_email_with_parser(raw: &[u8], folder: &str, seq: u32) -> EmailMessage {
    use mail_parser::MessageParser;

    let parser = MessageParser::default();
    if let Some(message) = parser.parse(raw) {
        let subject = message.subject().unwrap_or("").to_string();
        let from = message.from().and_then(|a| a.first())
            .map(|a| {
                if let Some(name) = a.name() {
                    if let Some(addr) = a.address() {
                        format!("{} <{}>", name, addr)
                    } else {
                        name.to_string()
                    }
                } else {
                    a.address().unwrap_or("").to_string()
                }
            })
            .unwrap_or_default();
        let to = message.to().and_then(|a| a.first())
            .map(|a| a.address().unwrap_or("").to_string())
            .unwrap_or_default();
        let date = message.date()
            .map(|d| d.to_rfc3339())
            .unwrap_or_default();
        let body_text = message.body_text(0).map(|t| t.to_string());
        let body_html = message.body_html(0).map(|h| h.to_string());

        EmailMessage {
            id: format!("{}_{}", folder, seq),
            uid: seq,
            from,
            to,
            subject,
            date,
            body_text,
            body_html,
            attachments: vec![],
            flags: vec![],
            folder: folder.to_string(),
        }
    } else {
        // Fallback to basic header parsing
        let text = String::from_utf8_lossy(raw);
        parse_pop3_email_basic(&text, folder, seq)
    }
}

fn parse_pop3_email_basic(response: &str, folder: &str, seq: u32) -> EmailMessage {
    let mut from = String::new();
    let mut to = String::new();
    let mut subject = String::new();
    let mut date = String::new();

    for line in response.lines() {
        let lower = line.to_lowercase();
        if lower.starts_with("from:") {
            from = line[5..].trim().to_string();
        } else if lower.starts_with("to:") {
            to = line[3..].trim().to_string();
        } else if lower.starts_with("subject:") {
            subject = line[8..].trim().to_string();
        } else if lower.starts_with("date:") {
            date = line[5..].trim().to_string();
        }
    }

    EmailMessage {
        id: format!("{}_{}", folder, seq),
        uid: seq,
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

fn read_response<T: Read>(stream: &mut T) -> Result<String, String> {
    let mut buf = [0u8; 4096];
    let n = stream.read(&mut buf).map_err(|e| format!("读取失败: {}", e))?;
    Ok(String::from_utf8_lossy(&buf[..n]).to_string())
}

/// Get emails from local cache with optional pagination
#[tauri::command]
pub fn get_cached_emails(vault_path: String, folder: String, offset: Option<usize>, limit: Option<usize>) -> Result<Vec<EmailMessage>, String> {
    let index_path = PathBuf::from(&vault_path)
        .join(".lifeos/emails")
        .join(&folder)
        .join("index.json");

    if !index_path.exists() {
        return Ok(Vec::new());
    }

    let content = fs::read_to_string(&index_path).map_err(|e| format!("读取失败: {}", e))?;
    let all_emails: Vec<EmailMessage> = serde_json::from_str(&content).map_err(|e| format!("解析失败: {}", e))?;

    let offset = offset.unwrap_or(0);
    let emails = if let Some(limit) = limit {
        all_emails.into_iter().skip(offset).take(limit).collect()
    } else {
        all_emails.into_iter().skip(offset).collect()
    };

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

// ── SMTP Send ──────────────────────────────────────────────────────────────

#[derive(Debug, Serialize, Deserialize)]
pub struct SmtpConfig {
    pub from_email: String,
    pub from_name: String,
    pub password: String,
    pub smtp_host: String,
    pub smtp_port: u16,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct SendEmailRequest {
    pub smtp: SmtpConfig,
    pub to: String,
    pub subject: String,
    pub body: String,
    pub in_reply_to: Option<String>,
}

/// Send an email via SMTP
#[tauri::command]
pub async fn send_email(request: SendEmailRequest) -> Result<(), String> {
    use lettre::{Message, SmtpTransport, Transport};
    use lettre::transport::smtp::authentication::Credentials;
    use lettre::message::header::ContentType;

    let email = Message::builder()
        .from(format!("{} <{}>", request.smtp.from_name, request.smtp.from_email)
            .parse()
            .map_err(|e| format!("发件人地址无效: {}", e))?)
        .to(request.to.parse().map_err(|e| format!("收件人地址无效: {}", e))?)
        .subject(&request.subject)
        .header(ContentType::TEXT_PLAIN)
        .body(request.body)
        .map_err(|e| format!("构建邮件失败: {}", e))?;

    let creds = Credentials::new(
        request.smtp.from_email.clone(),
        request.smtp.password.clone(),
    );

    let mailer = SmtpTransport::relay(&request.smtp.smtp_host)
        .map_err(|e| format!("SMTP 连接失败: {}", e))?
        .port(request.smtp.smtp_port)
        .credentials(creds)
        .build();

    mailer.send(&email).map_err(|e| format!("发送失败: {}", e))?;

    Ok(())
}
