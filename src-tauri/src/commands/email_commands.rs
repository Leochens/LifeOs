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
    pub account_id: Option<String>, // 用于区分不同账户的标识
}

/// Connect to IMAP or POP3 server and sync emails (with TLS support)
#[tauri::command]
pub async fn imap_sync(
    account: ImapAccount,
    vault_path: String,
    folder: String,
    max_emails: u32,
) -> Result<Vec<EmailMessage>, String> {
    let host = account.imap_host.clone();
    let port = account.imap_port;
    let email = account.email.clone();
    let password = account.password.clone();
    let protocol = account.protocol.clone().unwrap_or_else(|| "pop3".to_string());
    let account_id = account.account_id.clone();

    // Debug: 打印接收到的 account_id
    println!("[DEBUG] imap_sync received - email: {}, account_id: {:?}", email, account_id);

    // 使用 spawn_blocking 在后台线程执行阻塞的网络操作，避免阻塞主线程
    let vault_path_clone = vault_path.clone();
    let folder_clone = folder.clone();

    tokio::task::spawn_blocking(move || {
        // 使用 account_id 或 email 作为账户目录名
        let account_dir = account_id
            .unwrap_or_else(|| {
                println!("[DEBUG] account_id is None, using email as fallback: {}", email.replace("@", "_at_"));
                email.replace("@", "_at_")
            });

        // Determine if we need TLS (port 993/995 typically means SSL)
        let use_tls = port == 993 || port == 995;

        // Route to IMAP or POP3 based on protocol
        if protocol == "pop3" {
            if use_tls {
                pop3_sync_tls(&host, port, &email, &password, &vault_path_clone, &account_dir, max_emails)
            } else {
                pop3_sync_plain(&host, port, &email, &password, &vault_path_clone, &account_dir, max_emails)
            }
        } else {
            // IMAP — use the `imap` crate for reliable parsing
            imap_sync_with_crate(&host, port, &email, &password, &vault_path_clone, &account_dir, &folder_clone, max_emails, use_tls)
        }
    })
    .await
    .map_err(|e| format!("任务执行失败: {}", e))?
}

// ── IMAP via `imap` crate + `mail-parser` ────────────────────────────────────

fn imap_sync_with_crate(
    host: &str,
    port: u16,
    email: &str,
    password: &str,
    vault_path: &str,
    account_dir: &str,
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

    // 注意：ID 命令会导致 rust-imap panic，所以暂时跳过
    // 这会导致 163/126 等邮箱报 "Unsafe Login" 错误
    // 解决方案：使用 POP3 或升级到修复后的库版本

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

    // Fetch emails with RFC822 to get full message content
    let messages = session
        .fetch(&range, "UID FLAGS ENVELOPE RFC822")
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
        let body_opt = msg.body();
        if body_opt.is_none() {
            println!("[DEBUG] msg.body() returned None for uid {}", uid);
        } else {
            println!("[DEBUG] msg.body() has data, len: {}", body_opt.unwrap().len());
        }
        let (body_text, body_html) = match body_opt {
            Some(body) => parse_email_body(body),
            None => (None, None),
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
    let emails_dir = PathBuf::from(vault_path).join("Mailbox").join(account_dir);
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

/// Index entry for email metadata (stored in index.json)
#[derive(Debug, Serialize, Deserialize)]
pub struct EmailIndexEntry {
    pub uid: u32,
    pub message_id: Option<String>,
    pub subject: String,
    pub from: String,
    pub date: String,
    pub file: String,  // EML filename
    pub flags: Vec<String>,
}

fn pop3_sync_tls(
    host: &str,
    port: u16,
    email: &str,
    password: &str,
    vault_path: &str,
    account_dir: &str,
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
    let _message_count: usize = stat_resp
        .split_whitespace()
        .nth(1)
        .and_then(|n| n.parse().ok())
        .unwrap_or(0);

    // Get UIDL to track which emails we've already downloaded
    let local_uids = load_local_uids(vault_path, account_dir);
    let mut new_uids: std::collections::HashSet<u32> = std::collections::HashSet::new();

    // Request UIDL from server
    stream.write_all(b"UIDL\r\n").map_err(|e| format!("发送失败: {}", e))?;
    let uidl_resp = read_response(&mut stream)?;
    let server_uids = parse_uidl_response(&uidl_resp);

    // Determine which emails are new
    for (seq, _uid) in server_uids {
        if !local_uids.contains(&seq) {
            new_uids.insert(seq);
        }
    }

    let fetch_count = std::cmp::min(max_emails as usize, new_uids.len());

    if fetch_count == 0 {
        stream.write_all(b"QUIT\r\n").ok();
        // Return existing emails from cache
        return get_cached_emails(vault_path.to_string(), account_dir.to_string(), None, None);
    }

    // Fetch only new emails (from newest)
    let mut new_uids_vec: Vec<u32> = new_uids.into_iter().collect();
    new_uids_vec.sort_by(|a, b| b.cmp(a)); // Sort descending (newest first)
    let new_uids_to_fetch: Vec<u32> = new_uids_vec.into_iter().take(fetch_count).collect();

    // Prepare directory
    let emails_dir = PathBuf::from(vault_path).join("Mailbox").join(account_dir);
    fs::create_dir_all(&emails_dir).map_err(|e| format!("创建目录失败: {}", e))?;

    let mut emails = Vec::new();

    for seq in new_uids_to_fetch {
        let retr_cmd = format!("RETR {}\r\n", seq);
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

        // Strip POP3 +OK header line
        let resp_str = String::from_utf8_lossy(&response);
        let raw_email: &[u8] = if let Some(idx) = resp_str.find("\r\n") {
            &response[idx + 2..]
        } else {
            &response[..]
        };

        // Parse email
        let (email_msg, message_id) = parse_pop3_email_with_parser(raw_email, account_dir, seq);

        // Save as EML file using Message-ID as filename (or seq as fallback)
        let eml_filename = message_id.clone().unwrap_or_else(|| seq.to_string());
        let safe_filename = eml_filename.chars().filter(|c| c.is_alphanumeric() || *c == '@' || *c == '.' || *c == '-' || *c == '_').take(100).collect::<String>();
        let eml_path = emails_dir.join(format!("{}.eml", safe_filename));
        fs::write(&eml_path, raw_email).map_err(|e| format!("保存 EML 文件失败: {}", e))?;

        emails.push(email_msg);
    }

    stream.write_all(b"QUIT\r\n").ok();

    // Load existing index and merge with new emails
    let mut all_emails = load_existing_emails(vault_path, account_dir)?;
    for email in &emails {
        all_emails.push(email.clone());
    }

    // Sort by date (newest first)
    all_emails.sort_by(|a, b| b.date.cmp(&a.date));

    // Save updated index
    let index_path = emails_dir.join("index.json");
    let index_json = serde_json::to_string_pretty(&all_emails).map_err(|e| e.to_string())?;
    fs::write(&index_path, index_json).map_err(|e| format!("写入索引文件失败: {}", e))?;

    Ok(all_emails)
}

fn pop3_sync_plain(
    host: &str,
    port: u16,
    email: &str,
    password: &str,
    vault_path: &str,
    account_dir: &str,
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
    let _message_count: usize = stat_resp
        .split_whitespace()
        .nth(1)
        .and_then(|n| n.parse().ok())
        .unwrap_or(0);

    // Get UIDL to track which emails we've already downloaded
    let local_uids = load_local_uids(vault_path, account_dir);
    let mut new_uids: std::collections::HashSet<u32> = std::collections::HashSet::new();

    // Request UIDL from server
    stream.write_all(b"UIDL\r\n").map_err(|e| format!("发送失败: {}", e))?;
    let n = stream.read(&mut buf).map_err(|e| format!("读取失败: {}", e))?;
    let uidl_resp = String::from_utf8_lossy(&buf[..n]).to_string();
    let server_uids = parse_uidl_response(&uidl_resp);

    // Determine which emails are new
    for (seq, _uid) in server_uids {
        if !local_uids.contains(&seq) {
            new_uids.insert(seq);
        }
    }

    let fetch_count = std::cmp::min(max_emails as usize, new_uids.len());

    if fetch_count == 0 {
        stream.write_all(b"QUIT\r\n").ok();
        // Return existing emails from cache
        return get_cached_emails(vault_path.to_string(), account_dir.to_string(), None, None);
    }

    // Prepare directory
    let emails_dir = PathBuf::from(vault_path).join("Mailbox").join(account_dir);
    fs::create_dir_all(&emails_dir).map_err(|e| format!("创建目录失败: {}", e))?;

    // Fetch only new emails (from newest)
    let mut new_uids_vec: Vec<u32> = new_uids.into_iter().collect();
    new_uids_vec.sort_by(|a, b| b.cmp(a)); // Sort descending (newest first)
    let new_uids_to_fetch: Vec<u32> = new_uids_vec.into_iter().take(fetch_count).collect();

    let mut emails = Vec::new();

    for seq in new_uids_to_fetch {
        let retr_cmd = format!("RETR {}\r\n", seq);
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
        let raw_email: &[u8] = if let Some(idx) = resp_str.find("\r\n") {
            &response[idx + 2..]
        } else {
            &response[..]
        };

        // Parse email
        let (email_msg, message_id) = parse_pop3_email_with_parser(raw_email, account_dir, seq);

        // Save as EML file using Message-ID as filename (or seq as fallback)
        let eml_filename = message_id.clone().unwrap_or_else(|| seq.to_string());
        let safe_filename = eml_filename.chars().filter(|c| c.is_alphanumeric() || *c == '@' || *c == '.' || *c == '-' || *c == '_').take(100).collect::<String>();
        let eml_path = emails_dir.join(format!("{}.eml", safe_filename));
        fs::write(&eml_path, raw_email).map_err(|e| format!("保存 EML 文件失败: {}", e))?;

        emails.push(email_msg);
    }

    stream.write_all(b"QUIT\r\n").ok();

    // Load existing index and merge with new emails
    let mut all_emails = load_existing_emails(vault_path, account_dir)?;
    for email in &emails {
        all_emails.push(email.clone());
    }

    // Sort by date (newest first)
    all_emails.sort_by(|a, b| b.date.cmp(&a.date));

    // Save updated index
    let index_path = emails_dir.join("index.json");
    let index_json = serde_json::to_string_pretty(&all_emails).map_err(|e| e.to_string())?;
    fs::write(&index_path, index_json).map_err(|e| format!("写入索引文件失败: {}", e))?;

    Ok(all_emails)
}

/// Parse a POP3 email using mail-parser for proper MIME handling
/// Returns (EmailMessage, Option<Message-ID>)
fn parse_pop3_email_with_parser(raw: &[u8], folder: &str, seq: u32) -> (EmailMessage, Option<String>) {
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

        // Extract Message-ID for unique filename
        let message_id = message.message_id().map(|id| {
            let id_str = id.to_string();
            // Sanitize: remove < > brackets and invalid chars
            id_str.trim_matches(|c| c == '<' || c == '>')
                .chars()
                .filter(|c| c.is_alphanumeric() || *c == '@' || *c == '.' || *c == '-' || *c == '_')
                .take(100)
                .collect()
        });

        let email_msg = EmailMessage {
            id: message_id.clone().unwrap_or_else(|| format!("{}_{}", folder, seq)),
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
        };

        (email_msg, message_id)
    } else {
        // Fallback to basic header parsing
        let text = String::from_utf8_lossy(raw);
        parse_pop3_email_basic_raw(&text, folder, seq)
    }
}

fn parse_pop3_email_basic(response: &str, folder: &str, seq: u32) -> EmailMessage {
    let (msg, _) = parse_pop3_email_basic_raw(response, folder, seq);
    msg
}

fn parse_pop3_email_basic_raw(response: &str, folder: &str, seq: u32) -> (EmailMessage, Option<String>) {
    let mut from = String::new();
    let mut to = String::new();
    let mut subject = String::new();
    let mut date = String::new();
    let mut message_id: Option<String> = None;

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
        } else if lower.starts_with("message-id:") {
            let id = line[11..].trim().to_string();
            message_id = Some(id.trim_matches(|c| c == '<' || c == '>').to_string());
        }
    }

    let msg_id = message_id.clone().unwrap_or_else(|| format!("{}_{}", folder, seq));
    let email_msg = EmailMessage {
        id: msg_id,
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
    };

    (email_msg, message_id)
}

// ── Helper functions for EML file storage ─────────────────────────────────────

/// Load existing email UIDs from local index
fn load_local_uids(vault_path: &str, folder: &str) -> std::collections::HashSet<u32> {
    let index_path = PathBuf::from(vault_path)
        .join("Mailbox")
        .join(folder)
        .join("index.json");

    if !index_path.exists() {
        return std::collections::HashSet::new();
    }

    if let Ok(content) = fs::read_to_string(&index_path) {
        if let Ok(emails) = serde_json::from_str::<Vec<EmailMessage>>(&content) {
            return emails.iter().map(|e| e.uid).collect();
        }
    }

    std::collections::HashSet::new()
}

/// Parse UIDL response from POP3 server
/// Returns vector of (message_number, unique_id) tuples
fn parse_uidl_response(response: &str) -> Vec<(u32, String)> {
    let mut result = Vec::new();

    for line in response.lines() {
        let line = line.trim();
        if line.is_empty() || line.starts_with("+OK") {
            continue;
        }
        if line == "." {
            break;
        }

        // Format: "1 unique_id_12345"
        let parts: Vec<&str> = line.split_whitespace().collect();
        if parts.len() >= 2 {
            if let Ok(seq) = parts[0].parse::<u32>() {
                let uid = parts[1].to_string();
                result.push((seq, uid));
            }
        }
    }

    result
}

/// Load existing emails from local storage
fn load_existing_emails(vault_path: &str, folder: &str) -> Result<Vec<EmailMessage>, String> {
    let index_path = PathBuf::from(vault_path)
        .join("Mailbox")
        .join(folder)
        .join("index.json");

    if !index_path.exists() {
        return Ok(Vec::new());
    }

    let content = fs::read_to_string(&index_path).map_err(|e| format!("读取失败: {}", e))?;
    let emails: Vec<EmailMessage> = serde_json::from_str(&content).map_err(|e| format!("解析失败: {}", e))?;

    Ok(emails)
}

fn read_response<T: Read>(stream: &mut T) -> Result<String, String> {
    let mut buf = [0u8; 4096];
    let n = stream.read(&mut buf).map_err(|e| format!("读取失败: {}", e))?;
    Ok(String::from_utf8_lossy(&buf[..n]).to_string())
}

/// Get emails from local cache with optional pagination
#[tauri::command]
pub fn get_cached_emails(vault_path: String, account_id: String, offset: Option<usize>, limit: Option<usize>) -> Result<Vec<EmailMessage>, String> {
    let index_path = PathBuf::from(&vault_path)
        .join("Mailbox")
        .join(&account_id)
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
    let emails_dir = PathBuf::from(&vault_path).join("Mailbox");

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

/// Delete an email from local cache and optionally from IMAP server
#[tauri::command]
pub async fn delete_email(
    vault_path: String,
    account_id: String,
    email_id: String,
    imap_host: Option<String>,
    imap_port: Option<u16>,
    imap_password: Option<String>,
    email: Option<String>,
    folder: Option<String>,
) -> Result<(), String> {
    // Parse email_id to extract uid
    // email_id format: "FOLDER_UID" (e.g., "INBOX_123")
    // The uid is always the last part after splitting by underscore
    let uid: u32 = email_id
        .split('_')
        .last()
        .and_then(|s| s.parse().ok())
        .unwrap_or(0);

    // Use the provided folder parameter, or fall back to parsing from email_id
    let folder_name = folder.unwrap_or_else(|| {
        let parts: Vec<&str> = email_id.split('_').collect();
        if parts.len() >= 2 {
            parts[..parts.len() - 1].join("_")
        } else {
            "INBOX".to_string()
        }
    });

    // Load account info to get protocol
    let account_path = PathBuf::from(&vault_path)
        .join(".lifeos")
        .join("emails")
        .join(format!("{}.json", account_id));

    let protocol = if account_path.exists() {
        if let Ok(content) = fs::read_to_string(&account_path) {
            if let Ok(data) = serde_json::from_str::<serde_json::Value>(&content) {
                data.get("protocol")
                    .and_then(|p| p.as_str())
                    .unwrap_or("pop3")
                    .to_string()
            } else {
                "pop3".to_string()
            }
        } else {
            "pop3".to_string()
        }
    } else {
        "pop3".to_string()
    };

    // First, try to mark as deleted on IMAP server if it's IMAP protocol
    if protocol == "imap" {
        if let (Some(host), Some(port), Some(password), Some(email_addr)) =
            (&imap_host, &imap_port, &imap_password, &email)
        {
            let use_tls = *port == 993;

            let tls = native_tls::TlsConnector::builder()
                .danger_accept_invalid_certs(true)
                .build()
                .map_err(|e| format!("TLS 创建失败: {}", e))?;

            let client = if use_tls {
                imap::connect((host.as_str(), *port), host.as_str(), &tls)
                    .map_err(|e| format!("IMAP 连接失败: {}", e))?
            } else {
                let stream = TcpStream::connect((host.as_str(), *port))
                    .map_err(|e| format!("连接失败: {}", e))?;
                imap::Client::new(stream)
                    .secure(host.as_str(), &tls)
                    .map_err(|e| format!("STARTTLS 失败: {}", e))?
            };

            let mut session = client
                .login(&email_addr, &password)
                .map_err(|e| format!("登录失败: {}", e.0))?;

            // Select mailbox
            session.select(&folder_name).map_err(|e| format!("选择文件夹失败: {}", e))?;

            // Store +FLAGS (\Deleted) to mark as deleted using UID
            session
                .store(format!("{}", uid), "+FLAGS (\\Deleted)")
                .map_err(|e| format!("标记删除失败: {}", e))?;

            // Expunge to permanently delete
            session.expunge().map_err(|e| format!("永久删除失败: {}", e))?;

            session.logout().ok();
        }
    }

    // Delete from local cache
    let emails_dir = PathBuf::from(&vault_path)
        .join("Mailbox")
        .join(&account_id);

    // Load index.json
    let index_path = emails_dir.join("index.json");
    if index_path.exists() {
        let content = fs::read_to_string(&index_path)
            .map_err(|e| format!("读取索引失败: {}", e))?;
        let mut emails: Vec<EmailMessage> = serde_json::from_str(&content)
            .map_err(|e| format!("解析索引失败: {}", e))?;

        // Find and remove the email
        let original_len = emails.len();
        emails.retain(|e| e.id != email_id);

        if emails.len() < original_len {
            // Save updated index
            let index_json = serde_json::to_string_pretty(&emails)
                .map_err(|e| format!("序列化失败: {}", e))?;
            fs::write(&index_path, index_json)
                .map_err(|e| format!("写入索引失败: {}", e))?;
        }
    }

    // Try to delete EML file if exists
    // The EML filename is based on the email's id (message_id or folder_uid)
    let eml_files = vec![
        emails_dir.join(format!("{}.eml", email_id)),
        emails_dir.join(format!("{}.eml", uid)),
    ];

    for eml_path in eml_files {
        if eml_path.exists() {
            fs::remove_file(&eml_path).ok();
        }
    }

    Ok(())
}

/// Mark an email as read or unread
#[tauri::command]
pub async fn mark_email_read(
    vault_path: String,
    account_id: String,
    email_id: String,
    read: bool,
    folder: Option<String>,
    imap_host: Option<String>,
    imap_port: Option<u16>,
    imap_password: Option<String>,
    email: Option<String>,
) -> Result<(), String> {
    // Parse email_id to extract uid
    // email_id format: "FOLDER_UID" (e.g., "INBOX_123")
    let uid: u32 = email_id
        .split('_')
        .last()
        .and_then(|s| s.parse().ok())
        .unwrap_or(0);

    // Use the provided folder parameter, or fall back to parsing from email_id
    let folder_name = folder.unwrap_or_else(|| {
        let parts: Vec<&str> = email_id.split('_').collect();
        if parts.len() >= 2 {
            parts[..parts.len() - 1].join("_")
        } else {
            "INBOX".to_string()
        }
    });

    // Load account info to get protocol
    let account_path = PathBuf::from(&vault_path)
        .join(".lifeos")
        .join("emails")
        .join(format!("{}.json", account_id));

    let protocol = if account_path.exists() {
        if let Ok(content) = fs::read_to_string(&account_path) {
            if let Ok(data) = serde_json::from_str::<serde_json::Value>(&content) {
                data.get("protocol")
                    .and_then(|p| p.as_str())
                    .unwrap_or("pop3")
                    .to_string()
            } else {
                "pop3".to_string()
            }
        } else {
            "pop3".to_string()
        }
    } else {
        "pop3".to_string()
    };

    // First, try to mark as read/unread on IMAP server if it's IMAP protocol
    if protocol == "imap" {
        if let (Some(host), Some(port), Some(password), Some(email_addr)) =
            (&imap_host, &imap_port, &imap_password, &email)
        {
            let use_tls = *port == 993;

            let tls = native_tls::TlsConnector::builder()
                .danger_accept_invalid_certs(true)
                .build()
                .map_err(|e| format!("TLS 创建失败: {}", e))?;

            let client = if use_tls {
                imap::connect((host.as_str(), *port), host.as_str(), &tls)
                    .map_err(|e| format!("IMAP 连接失败: {}", e))?
            } else {
                let stream = TcpStream::connect((host.as_str(), *port))
                    .map_err(|e| format!("连接失败: {}", e))?;
                imap::Client::new(stream)
                    .secure(host.as_str(), &tls)
                    .map_err(|e| format!("STARTTLS 失败: {}", e))?
            };

            let mut session = client
                .login(&email_addr, &password)
                .map_err(|e| format!("登录失败: {}", e.0))?;

            // Select mailbox
            session.select(&folder_name).map_err(|e| format!("选择文件夹失败: {}", e))?;

            // Store flags to mark as read/unread using UID
            let flag_action = if read { "+FLAGS (\\Seen)" } else { "-FLAGS (\\Seen)" };
            session
                .store(format!("{}", uid), flag_action)
                .map_err(|e| format!("标记已读/未读失败: {}", e))?;

            session.logout().ok();
        }
    }

    // Update local cache
    let emails_dir = PathBuf::from(&vault_path)
        .join("Mailbox")
        .join(&account_id);

    let index_path = emails_dir.join("index.json");
    if index_path.exists() {
        let content = fs::read_to_string(&index_path)
            .map_err(|e| format!("读取索引失败: {}", e))?;
        let mut emails: Vec<EmailMessage> = serde_json::from_str(&content)
            .map_err(|e| format!("解析索引失败: {}", e))?;

        // Find and update the email's flags
        for email in emails.iter_mut() {
            if email.id == email_id {
                if read {
                    // Add Seen flag if not present
                    if !email.flags.contains(&"Seen".to_string()) {
                        email.flags.push("Seen".to_string());
                    }
                } else {
                    // Remove Seen flag
                    email.flags.retain(|f| f != "Seen");
                }
                break;
            }
        }

        // Save updated index
        let index_json = serde_json::to_string_pretty(&emails)
            .map_err(|e| format!("序列化失败: {}", e))?;
        fs::write(&index_path, index_json)
            .map_err(|e| format!("写入索引失败: {}", e))?;
    }

    Ok(())
}
