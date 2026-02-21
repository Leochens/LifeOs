mod commands;

use commands::{fs_commands, vault_commands, extra_commands, email_commands};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_shell::init())
        .invoke_handler(tauri::generate_handler![
            // Vault / config
            vault_commands::get_vault_path,
            vault_commands::set_vault_path,
            vault_commands::init_vault,
            vault_commands::load_menu_config,
            vault_commands::save_menu_config,
            vault_commands::load_board_config,
            vault_commands::save_board_config,
            vault_commands::regenerate_skills,
            vault_commands::load_app_settings,
            vault_commands::save_app_settings,
            // Generic file system
            fs_commands::read_file,
            fs_commands::write_file,
            fs_commands::delete_file,
            fs_commands::list_dir,
            fs_commands::file_exists,
            fs_commands::create_dir_all,
            fs_commands::move_file,
            // Parsed note access
            fs_commands::read_note,
            fs_commands::write_note,
            fs_commands::list_notes,
            // Extra: system & tools
            extra_commands::open_in_finder,
            extra_commands::run_shell_command,
            extra_commands::run_shortcut,
            // Extra: git scanner
            extra_commands::scan_git_repos,
            // Extra: skills manager
            extra_commands::get_skill_paths,
            extra_commands::list_skill_files,
            // Extra: launchd scheduler
            extra_commands::create_launchd_task,
            extra_commands::list_launchd_tasks,
            extra_commands::delete_launchd_task,
            // Apple Notes
            extra_commands::get_apple_notes,
            extra_commands::create_apple_note,
            extra_commands::update_apple_note,
            // Email: IMAP sync
            email_commands::imap_sync,
            email_commands::get_cached_emails,
            email_commands::list_email_folders,
            email_commands::send_email,
        ])
        .run(tauri::generate_context!())
        .expect("error while running Life OS");
}
