fn main() {
    // When running cargo check or compilation prior to npm run build,
    // ensure the mcp bundle directory and a placeholder exist so
    // tauri_build's resources glob ("../dist/mcp/*") does not fail.
    let mcp_dir = std::path::Path::new("../dist/mcp");
    if !mcp_dir.exists() {
        let _ = std::fs::create_dir_all(mcp_dir);
    }
    let has_files = std::fs::read_dir(mcp_dir)
        .map(|mut entries| entries.next().is_some())
        .unwrap_or(false);
    if !has_files {
        let placeholder = mcp_dir.join(".gitkeep");
        let _ = std::fs::write(placeholder, "");
    }

    tauri_build::build()
}
