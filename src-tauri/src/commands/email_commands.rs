use serde::{Deserialize, Serialize};
use native_tls::TlsConnector;
use std::fs;
use std::io::{Cursor, Read, Write};
use std::net::TcpStream;
use std::path::PathBuf;

/// A stream wrapper that replays a prefix buffer before delegating to the inner stream.
/// Used to replay the IMAP greeting after manually sending the ID command.
#[derive(Debug)]
struct PrefixStream<T> {
    inner: T,
    prefix: Cursor<Vec<u8>>,
    prefix_done: bool,
}

impl<T> PrefixStream<T> {
    fn new(inner: T, prefix: Vec<u8>) -> Self {
        PrefixStream {
            inner,
            prefix: Cursor::new(prefix),
            prefix_done: false,
        }
    }
}

impl<T: Read> Read for PrefixStream<T> {
    fn read(&mut self, buf: &mut [u8]) -> std::io::Result<usize> {
        if !self.prefix_done {
            let n = self.prefix.read(buf)?;
            if n == 0 {
                self.prefix_done = true;
                self.inner.read(buf)
            } else {
                Ok(n)
            }
        } else {
            self.inner.read(buf)
        }
    }
}

impl<T: Write> Write for PrefixStream<T> {
    fn write(&mut self, buf: &[u8]) -> std::io::Result<usize> {
        self.inner.write(buf)
    }
    fn flush(&mut self) -> std::io::Result<()> {
        self.inner.flush()
    }
}

/// Sync state for a single folder, persisted between sessions
#[derive(Debug, Serialize, Deserialize, Default, Clone)]
pub struct FolderSyncState {
    #[serde(rename = "uidValidity")]
    pub uid_validity: u32,
    #[serde(rename = "lastUid")]
    pub last_uid: u32,
    #[serde(rename = "lastSync")]
    pub last_sync: String,
}

type SyncStateMap = std::collections::HashMap<String, FolderSyncState>;

fn load_sync_state(vault_path: &str, account_dir: &str) -> SyncStateMap {
    let path = PathBuf::from(vault_path)
        .join("Mailbox")
        .join(account_dir)
        .join("sync_state.json");
    if let Ok(content) = fs::read_to_string(&path) {
        serde_json::from_str(&content).unwrap_or_default()
    } else {
        SyncStateMap::new()
    }
}

fn save_sync_state(vault_path: &str, account_dir: &str, state: &SyncStateMap) -> Result<(), String> {
    let dir = PathBuf::from(vault_path).join("Mailbox").join(account_dir);
    fs::create_dir_all(&dir).map_err(|e| format!("创建目录失败: {}", e))?;
    let path = dir.join("sync_state.json");
    let json = serde_json::to_string_pretty(state).map_err(|e| e.to_string())?;
    fs::write(&path, json).map_err(|e| format!("写入 sync_state 失败: {}", e))
}

/// Read a single CRLF-terminated line from a stream (byte-by-byte for safety)
fn read_imap_line(stream: &mut impl Read) -> Result<Vec<u8>, String> {
    let mut line = Vec::with_capacity(256);
    let mut buf = [0u8; 1];
    loop {
        stream.read_exact(&mut buf).map_err(|e| format!("读取 IMAP 响应失败: {}", e))?;
        line.push(buf[0]);
        if line.len() >= 2 && line[line.len() - 2] == b'\r' && line[line.len() - 1] == b'\n' {
            break;
        }
        if line.len() > 8192 {
            break; // Safety limit
        }
    }
    Ok(line)
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct EmailMessage {
    #[serde(rename = "id")]
    pub id: String,
    #[serde(rename = "uid")]
    pub uid: u32,
    #[serde(rename = "uidString")]
    pub uid_string: Option<String>, // POP3 UIDL unique identifier
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
    skip: Option<u32>,
) -> Result<Vec<EmailMessage>, String> {
    let host = account.imap_host.clone();
    let port = account.imap_port;
    let email = account.email.clone();
    let password = account.password.clone();
    let protocol = account.protocol.clone().unwrap_or_else(|| "imap".to_string());
    let account_id = account.account_id.clone();
    let skip = skip.unwrap_or(0);

    println!("[DEBUG] imap_sync received - email: {}, account_id: {:?}, skip: {}", email, account_id, skip);

    let vault_path_clone = vault_path.clone();
    let folder_clone = folder.clone();

    tokio::task::spawn_blocking(move || {
        let account_dir = account_id
            .unwrap_or_else(|| {
                println!("[DEBUG] account_id is None, using email as fallback: {}", email.replace("@", "_at_"));
                email.replace("@", "_at_")
            });

        let use_tls = port == 993 || port == 995;

        if protocol == "pop3" {
            if use_tls {
                pop3_sync_tls(&host, port, &email, &password, &vault_path_clone, &account_dir, max_emails, skip)
            } else {
                pop3_sync_plain(&host, port, &email, &password, &vault_path_clone, &account_dir, max_emails, skip)
            }
        } else {
            imap_sync_with_crate(&host, port, &email, &password, &vault_path_clone, &account_dir, &folder_clone, max_emails, skip, use_tls)
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
    skip: u32,
    use_tls: bool,
) -> Result<Vec<EmailMessage>, String> {
    let tls = native_tls::TlsConnector::builder()
        .danger_accept_invalid_certs(true)
        .build()
        .map_err(|e| format!("TLS 创建失败: {}", e))?;

    if use_tls {
        // Connect manually to send IMAP ID command before login.
        // Required by NetEase (163/126/yeah.net) to avoid "Unsafe Login" error.
        let tcp = TcpStream::connect((host, port))
            .map_err(|e| format!("连接失败: {}", e))?;
        tcp.set_read_timeout(Some(std::time::Duration::from_secs(30))).ok();

        let mut tls_stream = tls.connect(host, tcp)
            .map_err(|e| format!("TLS 握手失败: {}", e))?;

        // Read server greeting
        let greeting = read_imap_line(&mut tls_stream)?;
        println!("[DEBUG] IMAP greeting: {}", String::from_utf8_lossy(&greeting).trim());

        // Send IMAP ID command (RFC 2971) — needed by 163/126/yeah.net
        tls_stream.write_all(
            b"A000 ID (\"name\" \"LifeOS\" \"version\" \"1.0.0\" \"vendor\" \"LifeOS\")\r\n"
        ).map_err(|e| format!("发送 ID 命令失败: {}", e))?;
        tls_stream.flush().map_err(|e| format!("flush 失败: {}", e))?;

        // Read ID response until tagged response
        loop {
            let line = read_imap_line(&mut tls_stream)?;
            let line_str = String::from_utf8_lossy(&line);
            println!("[DEBUG] ID response: {}", line_str.trim());
            if line_str.starts_with("A000 ") {
                break;
            }
        }

        // Wrap stream: replay greeting so imap::Client::new() sees it
        let prefix_stream = PrefixStream::new(tls_stream, greeting);
        let client = imap::Client::new(prefix_stream);

        let mut session = client
            .login(email, password)
            .map_err(|e| format!("登录失败: {}", e.0))?;

        let result = imap_fetch_emails(&mut session, folder, max_emails, skip, vault_path, account_dir);
        session.logout().ok();
        result
    } else {
        // Non-TLS: use STARTTLS via imap crate (ID command not injected here)
        let stream = TcpStream::connect((host, port))
            .map_err(|e| format!("连接失败: {}", e))?;
        let client = imap::Client::new(stream)
            .secure(host, &tls)
            .map_err(|e| format!("STARTTLS 失败: {}", e))?;

        let mut session = client
            .login(email, password)
            .map_err(|e| format!("登录失败: {}", e.0))?;

        let result = imap_fetch_emails(&mut session, folder, max_emails, skip, vault_path, account_dir);
        session.logout().ok();
        result
    }
}

/// Fetch a page of emails from IMAP by sequence-number range.
/// skip=0 → latest max_emails; skip=20 → the 20 emails before those; etc.
fn imap_fetch_emails<T: Read + Write>(
    session: &mut imap::Session<T>,
    folder: &str,
    max_emails: u32,
    skip: u32,
    vault_path: &str,
    account_dir: &str,
) -> Result<Vec<EmailMessage>, String> {
    let mailbox = session
        .select(folder)
        .map_err(|e| format!("选择文件夹失败: {}", e))?;

    let total = mailbox.exists as u32;

    if total == 0 || skip >= total {
        return Ok(Vec::new());
    }

    // Sequence numbers count from 1 (oldest) to total (newest).
    // fetch_end is the newest message in this page.
    let fetch_end = total - skip;
    let fetch_start = fetch_end.saturating_sub(max_emails.saturating_sub(1)).max(1);
    let range = format!("{}:{}", fetch_start, fetch_end);

    println!("[SYNC] folder={} total={} skip={} range={}", folder, total, skip, range);

    let emails_dir = PathBuf::from(vault_path).join("Mailbox").join(account_dir);
    fs::create_dir_all(&emails_dir).map_err(|e| format!("创建目录失败: {}", e))?;

    let messages = session
        .fetch(&range, "(UID FLAGS RFC822)")
        .map_err(|e| format!("拉取邮件失败: {}", e))?;

    let mut emails = parse_imap_messages(&messages, folder, &emails_dir)?;
    emails.reverse(); // newest first within this page

    Ok(emails)
}

/// Returns current UTC time as RFC3339 string (without chrono dependency)
fn chrono_now() -> String {
    use std::time::{SystemTime, UNIX_EPOCH};
    let secs = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0);
    // Simple ISO 8601 UTC timestamp
    let s = secs;
    let sec = s % 60;
    let min = (s / 60) % 60;
    let hour = (s / 3600) % 24;
    let days = s / 86400;
    // Approximate date (good enough for sync metadata logging)
    let year = 1970 + days / 365;
    let day_of_year = days % 365;
    let month = day_of_year / 30 + 1;
    let day = day_of_year % 30 + 1;
    format!("{:04}-{:02}-{:02}T{:02}:{:02}:{:02}Z", year, month, day, hour, min, sec)
}

/// Parse a collection of IMAP fetch responses into EmailMessage structs,
/// saving each RFC822 body as a .eml file.
fn parse_imap_messages(
    messages: &imap::types::ZeroCopy<Vec<imap::types::Fetch>>,
    folder: &str,
    emails_dir: &PathBuf,
) -> Result<Vec<EmailMessage>, String> {
    let mut emails = Vec::new();

    for msg in messages.iter() {
        let uid = msg.uid.unwrap_or(0);
        let email_id = format!("{}_{}", folder, uid);

        // Save raw RFC822 as .eml file
        if let Some(raw) = msg.body() {
            let eml_path = emails_dir.join(format!("{}.eml", email_id));
            fs::write(&eml_path, raw).map_err(|e| format!("保存 EML 文件失败: {}", e))?;
        }

        // Parse flags
        let flags: Vec<String> = msg
            .flags()
            .iter()
            .map(|f| format!("{:?}", f))
            .collect();

        // Parse the full email from RFC822 body using mail-parser
        let (subject, from, to, date, body_text, body_html) = match msg.body() {
            Some(raw) => {
                println!("[DEBUG] RFC822 body for uid {}: {} bytes", uid, raw.len());
                use mail_parser::MessageParser;
                let parser = MessageParser::default();
                if let Some(parsed) = parser.parse(raw) {
                    let subject = parsed.subject().unwrap_or("").to_string();
                    let from = parsed.from().and_then(|a| a.first())
                        .map(|a| {
                            if let Some(name) = a.name() {
                                if let Some(addr) = a.address() {
                                    format!("{} <{}>", name, addr)
                                } else { name.to_string() }
                            } else {
                                a.address().unwrap_or("").to_string()
                            }
                        }).unwrap_or_default();
                    let to = parsed.to().and_then(|a| a.first())
                        .map(|a| a.address().unwrap_or("").to_string())
                        .unwrap_or_default();
                    let date = parsed.date()
                        .map(|d| d.to_rfc3339())
                        .unwrap_or_default();
                    let body_text = parsed.body_text(0).map(|t| t.to_string());
                    let body_html = parsed.body_html(0).map(|h| h.to_string());
                    (subject, from, to, date, body_text, body_html)
                } else {
                    println!("[DEBUG] mail-parser failed to parse uid {}", uid);
                    (String::new(), String::new(), String::new(), String::new(), None, None)
                }
            }
            None => {
                println!("[DEBUG] msg.body() returned None for uid {}", uid);
                (String::new(), String::new(), String::new(), String::new(), None, None)
            }
        };

        emails.push(EmailMessage {
            id: email_id,
            uid,
            uid_string: Some(uid.to_string()),
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

    Ok(emails)
}

/// Save metadata-only index.json (strips body content)
fn save_index_json(emails_dir: &PathBuf, emails: &[EmailMessage]) -> Result<(), String> {
    let index_entries: Vec<EmailMessage> = emails.iter().map(|e| EmailMessage {
        id: e.id.clone(),
        uid: e.uid,
        uid_string: e.uid_string.clone(),
        from: e.from.clone(),
        to: e.to.clone(),
        subject: e.subject.clone(),
        date: e.date.clone(),
        body_text: None,
        body_html: None,
        attachments: e.attachments.clone(),
        flags: e.flags.clone(),
        folder: e.folder.clone(),
    }).collect();
    let index_path = emails_dir.join("index.json");
    let index_json = serde_json::to_string_pretty(&index_entries).map_err(|e| e.to_string())?;
    fs::write(&index_path, index_json).map_err(|e| format!("写入索引文件失败: {}", e))
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
    skip: u32,
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

    // Get UIDL list (all messages)
    stream.write_all(b"UIDL\r\n").map_err(|e| format!("发送失败: {}", e))?;
    let uidl_resp = read_response(&mut stream)?;
    let mut server_uids = parse_uidl_response(&uidl_resp);

    // Sort newest first (by seq number descending)
    server_uids.sort_by(|a, b| b.0.cmp(&a.0));

    // Apply skip + limit to get the current page
    let page: Vec<(u32, String)> = server_uids
        .into_iter()
        .skip(skip as usize)
        .take(max_emails as usize)
        .collect();

    println!("[SYNC] POP3 TLS: skip={} max={} page_count={}", skip, max_emails, page.len());

    if page.is_empty() {
        stream.write_all(b"QUIT\r\n").ok();
        return Ok(Vec::new());
    }

    let emails_dir = PathBuf::from(vault_path).join("Mailbox").join(account_dir);
    fs::create_dir_all(&emails_dir).map_err(|e| format!("创建目录失败: {}", e))?;

    let mut emails = Vec::new();

    for (seq, uid_string) in page {
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

        let (email_msg, message_id) = parse_pop3_email_with_parser(raw_email, account_dir, seq, Some(uid_string.clone()));

        let eml_filename = message_id.clone().unwrap_or_else(|| seq.to_string());
        let safe_filename = eml_filename.chars().filter(|c| c.is_alphanumeric() || *c == '@' || *c == '.' || *c == '-' || *c == '_').take(100).collect::<String>();
        let eml_path = emails_dir.join(format!("{}.eml", safe_filename));
        fs::write(&eml_path, raw_email).map_err(|e| format!("保存 EML 文件失败: {}", e))?;

        emails.push(email_msg);
    }

    stream.write_all(b"QUIT\r\n").ok();

    Ok(emails)
}

fn pop3_sync_plain(
    host: &str,
    port: u16,
    email: &str,
    password: &str,
    vault_path: &str,
    account_dir: &str,
    max_emails: u32,
    skip: u32,
) -> Result<Vec<EmailMessage>, String> {
    let addr = format!("{}:{}", host, port);
    let mut stream = TcpStream::connect(&addr).map_err(|e| format!("连接失败: {}", e))?;
    stream.set_read_timeout(Some(std::time::Duration::from_secs(30))).ok();

    let mut buf = [0u8; 4096];
    stream.read(&mut buf).map_err(|e| format!("读取失败: {}", e))?;

    // Login
    let user_cmd = format!("USER {}\r\n", email);
    stream.write_all(user_cmd.as_bytes()).map_err(|e| format!("发送失败: {}", e))?;
    let n = stream.read(&mut buf).map_err(|e| format!("读取失败: {}", e))?;
    if !String::from_utf8_lossy(&buf[..n]).contains("+OK") {
        return Err(format!("USER 命令失败"));
    }

    let pass_cmd = format!("PASS {}\r\n", password);
    stream.write_all(pass_cmd.as_bytes()).map_err(|e| format!("发送失败: {}", e))?;
    let n = stream.read(&mut buf).map_err(|e| format!("读取失败: {}", e))?;
    if !String::from_utf8_lossy(&buf[..n]).contains("+OK") {
        return Err(format!("登录失败"));
    }

    // Get UIDL list
    stream.write_all(b"UIDL\r\n").map_err(|e| format!("发送失败: {}", e))?;
    let n = stream.read(&mut buf).map_err(|e| format!("读取失败: {}", e))?;
    let uidl_resp = String::from_utf8_lossy(&buf[..n]).to_string();
    let mut server_uids = parse_uidl_response(&uidl_resp);

    // Sort newest first
    server_uids.sort_by(|a, b| b.0.cmp(&a.0));

    // Apply skip + limit
    let page: Vec<(u32, String)> = server_uids
        .into_iter()
        .skip(skip as usize)
        .take(max_emails as usize)
        .collect();

    println!("[SYNC] POP3 plain: skip={} max={} page_count={}", skip, max_emails, page.len());

    if page.is_empty() {
        stream.write_all(b"QUIT\r\n").ok();
        return Ok(Vec::new());
    }

    let emails_dir = PathBuf::from(vault_path).join("Mailbox").join(account_dir);
    fs::create_dir_all(&emails_dir).map_err(|e| format!("创建目录失败: {}", e))?;

    let mut emails = Vec::new();

    for (seq, uid_string) in page {
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

        let (email_msg, message_id) = parse_pop3_email_with_parser(raw_email, account_dir, seq, Some(uid_string.clone()));

        let eml_filename = message_id.clone().unwrap_or_else(|| seq.to_string());
        let safe_filename = eml_filename.chars().filter(|c| c.is_alphanumeric() || *c == '@' || *c == '.' || *c == '-' || *c == '_').take(100).collect::<String>();
        let eml_path = emails_dir.join(format!("{}.eml", safe_filename));
        fs::write(&eml_path, raw_email).map_err(|e| format!("保存 EML 文件失败: {}", e))?;

        emails.push(email_msg);
    }

    stream.write_all(b"QUIT\r\n").ok();

    Ok(emails)
}

/// Parse a POP3 email using mail-parser for proper MIME handling
/// Returns (EmailMessage, Option<Message-ID>)
fn parse_pop3_email_with_parser(raw: &[u8], folder: &str, seq: u32, uid_string: Option<String>) -> (EmailMessage, Option<String>) {
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
            uid_string,
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
        parse_pop3_email_basic_raw(&text, folder, seq, None)
    }
}

fn parse_pop3_email_basic(response: &str, folder: &str, seq: u32) -> EmailMessage {
    let (msg, _) = parse_pop3_email_basic_raw(response, folder, seq, None);
    msg
}

fn parse_pop3_email_basic_raw(response: &str, folder: &str, seq: u32, uid_string: Option<String>) -> (EmailMessage, Option<String>) {
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
        uid_string,
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

/// Load existing email UIDs from local index (using string UID from UIDL)
fn load_local_uids(vault_path: &str, folder: &str) -> std::collections::HashSet<String> {
    let index_path = PathBuf::from(vault_path)
        .join("Mailbox")
        .join(folder)
        .join("index.json");

    if !index_path.exists() {
        return std::collections::HashSet::new();
    }

    if let Ok(content) = fs::read_to_string(&index_path) {
        if let Ok(emails) = serde_json::from_str::<Vec<EmailMessage>>(&content) {
            // Use uid_string if available, otherwise fall back to uid
            return emails.iter()
                .filter_map(|e| e.uid_string.clone().or_else(|| Some(e.uid.to_string())))
                .collect();
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

/// Get full email content from .eml file
#[tauri::command]
pub fn get_email_content(vault_path: String, account_id: String, email_id: String) -> Result<EmailMessage, String> {
    let safe_id = email_id.replace('/', "_").replace('\\', "_");

    // Try .eml file first (standard format)
    let eml_path = PathBuf::from(&vault_path)
        .join("Mailbox")
        .join(&account_id)
        .join(format!("{}.eml", safe_id));

    if eml_path.exists() {
        // Read and parse .eml file
        let raw_bytes = fs::read(&eml_path).map_err(|e| format!("读取邮件失败: {}", e))?;
        use mail_parser::MessageParser;
        let parser = MessageParser::default();

        if let Some(parsed) = parser.parse(&raw_bytes) {
            let subject = parsed.subject().unwrap_or("").to_string();
            let from = parsed.from().and_then(|a| a.first())
                .map(|a| {
                    if let Some(name) = a.name() {
                        if let Some(addr) = a.address() {
                            format!("{} <{}>", name, addr)
                        } else { name.to_string() }
                    } else {
                        a.address().unwrap_or("").to_string()
                    }
                }).unwrap_or_default();
            let to = parsed.to().and_then(|a| a.first())
                .map(|a| a.address().unwrap_or("").to_string())
                .unwrap_or_default();
            let date = parsed.date()
                .map(|d| d.to_rfc3339())
                .unwrap_or_default();
            let body_text = parsed.body_text(0).map(|t| t.to_string());
            let body_html = parsed.body_html(0).map(|h| h.to_string());

            // Extract Message-ID for the id field
            let message_id = parsed.message_id()
                .map(|id| id.to_string())
                .unwrap_or_else(|| email_id.clone());

            return Ok(EmailMessage {
                id: message_id,
                uid: 0,
                uid_string: None,
                from,
                to,
                subject,
                date,
                body_text,
                body_html,
                attachments: vec![],
                flags: vec![],
                folder: account_id,
            });
        }
    }

    // Fallback: try JSON file (legacy format)
    let json_path = PathBuf::from(&vault_path)
        .join("Mailbox")
        .join(&account_id)
        .join(format!("{}.json", safe_id));

    if json_path.exists() {
        let content = fs::read_to_string(&json_path).map_err(|e| format!("读取邮件失败: {}", e))?;
        let email: EmailMessage = serde_json::from_str(&content).map_err(|e| format!("解析邮件失败: {}", e))?;
        return Ok(email);
    }

    Err(format!("邮件文件不存在: {}", email_id))
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

    // 处理发件人地址，如果 from_name 为空或与 from_email 相同则直接使用邮箱地址
    let from_name_trimmed = request.smtp.from_name.trim();
    let from_address = if from_name_trimmed.is_empty() || from_name_trimmed == &request.smtp.from_email {
        // 名称为空或与邮箱相同，直接使用邮箱地址
        request.smtp.from_email.clone()
    } else {
        format!("{} <{}>", request.smtp.from_name, request.smtp.from_email)
    };

    // 调试日志
    println!("[DEBUG send_email] from_email: {:?}", request.smtp.from_email);
    println!("[DEBUG send_email] from_name: {:?}", request.smtp.from_name);
    println!("[DEBUG send_email] from_address: {:?}", from_address);

    let email = Message::builder()
        .from(from_address
            .parse()
            .map_err(|e| format!("发件人地址无效: {} (from_address: {:?})", e, from_address))?)
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
                    .unwrap_or("imap")
                    .to_string()
            } else {
                "imap".to_string()
            }
        } else {
            "imap".to_string()
        }
    } else {
        "imap".to_string()
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
                    .unwrap_or("imap")
                    .to_string()
            } else {
                "imap".to_string()
            }
        } else {
            "imap".to_string()
        }
    } else {
        "imap".to_string()
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

/// Open URL in external browser
#[tauri::command]
pub async fn open_external_url(url: String) -> Result<(), String> {
    open::that(&url).map_err(|e| format!("打开链接失败: {}", e))
}
