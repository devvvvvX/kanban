use std::fs;
use std::path::PathBuf;
use tauri::Manager;

fn get_db_file_path(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    let mut dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    dir.push("kanban.db");
    Ok(dir)
}

#[tauri::command]
fn get_database_path(app: tauri::AppHandle) -> Result<String, String> {
    let path = get_db_file_path(&app)?;
    Ok(path.to_string_lossy().to_string())
}

#[tauri::command]
fn load_database_from_disk(app: tauri::AppHandle) -> Result<Option<Vec<u8>>, String> {
    let path = get_db_file_path(&app)?;
    if path.exists() {
        let bytes = fs::read(&path).map_err(|e| e.to_string())?;
        if bytes.len() >= 16 && &bytes[0..16] == b"SQLite format 3\0" {
            return Ok(Some(bytes));
        }
    }
    Ok(None)
}

#[tauri::command]
fn save_database_to_disk(app: tauri::AppHandle, bytes: Vec<u8>) -> Result<(), String> {
    if bytes.len() < 16 || &bytes[0..16] != b"SQLite format 3\0" {
        return Err("Invalid SQLite database bytes".to_string());
    }
    let path = get_db_file_path(&app)?;
    fs::write(&path, bytes).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
fn delete_database_from_disk(app: tauri::AppHandle) -> Result<bool, String> {
    let path = get_db_file_path(&app)?;
    if path.exists() {
        fs::remove_file(&path).map_err(|e| e.to_string())?;
        return Ok(true);
    }
    Ok(false)
}

#[tauri::command]
fn show_in_finder(app: tauri::AppHandle) -> Result<(), String> {
    let path = get_db_file_path(&app)?;
    #[cfg(target_os = "macos")]
    {
        use std::process::Command;
        if path.exists() {
            let _ = Command::new("open").arg("-R").arg(&path).spawn();
        } else if let Some(parent) = path.parent() {
            let _ = Command::new("open").arg(parent).spawn();
        }
    }
    #[cfg(not(target_os = "macos"))]
    {
        let _ = path;
    }
    Ok(())
}

#[tauri::command]
fn open_external_url(url: String) -> Result<(), String> {
    #[cfg(target_os = "macos")]
    {
        use std::process::Command;
        let _ = Command::new("open").arg(&url).spawn().map_err(|e| e.to_string())?;
    }
    #[cfg(not(target_os = "macos"))]
    {
        let _ = url;
    }
    Ok(())
}

#[tauri::command]
fn send_native_notification(
    app: tauri::AppHandle,
    title: String,
    subtitle: Option<String>,
    body: String,
    sound: Option<String>,
) -> Result<(), String> {
    #[cfg(target_os = "macos")]
    {
        use std::process::Command;

        let escape_str = |s: &str| -> String {
            s.replace('\\', "\\\\").replace('"', "\\\"")
        };

        let clean_title = escape_str(&title);
        let clean_body = escape_str(&body);
        let sound_name = match sound.as_deref() {
            Some("alarm") => "Ping",
            Some("chime") => "Glass",
            Some("bell") => "Hero",
            Some("ping") => "Ping",
            Some(s) if !s.is_empty() => s,
            _ => "Ping",
        };

        let script = if let Some(sub) = subtitle {
            let clean_sub = escape_str(&sub);
            format!(
                "display notification \"{}\" with title \"{}\" subtitle \"{}\" sound name \"{}\"",
                clean_body, clean_title, clean_sub, sound_name
            )
        } else {
            format!(
                "display notification \"{}\" with title \"{}\" sound name \"{}\"",
                clean_body, clean_title, sound_name
            )
        };

        let _ = Command::new("osascript")
            .arg("-e")
            .arg(&script)
            .spawn()
            .map_err(|e| e.to_string())?;

        if let Some(window) = app.get_webview_window("main") {
            let _ = window.request_user_attention(Some(tauri::UserAttentionType::Critical));
        }
    }
    #[cfg(not(target_os = "macos"))]
    {
        let _ = (app, title, subtitle, body, sound);
    }
    Ok(())
}

#[tauri::command]
fn focus_app_window(app: tauri::AppHandle) -> Result<(), String> {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.show();
        let _ = window.unminimize();
        let _ = window.set_focus();
    }
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            get_database_path,
            load_database_from_disk,
            save_database_to_disk,
            delete_database_from_disk,
            show_in_finder,
            open_external_url,
            send_native_notification,
            focus_app_window,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
