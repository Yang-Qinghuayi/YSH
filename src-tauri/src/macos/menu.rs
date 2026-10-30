use tauri::menu::MenuEvent;
use tauri::menu::{SubmenuBuilder, HELP_SUBMENU_ID};
use tauri::AppHandle;
use tauri_plugin_opener::OpenerExt;

pub fn setup_macos_menu(app: &AppHandle) -> tauri::Result<()> {
    let global_menu = app.menu().unwrap();

    if let Some(item) = global_menu.get(HELP_SUBMENU_ID) {
        global_menu.remove(&item)?;
    }

    global_menu.append(
        &SubmenuBuilder::new(app, "Help")
            .text("report_issue", "Report An Issue...")
            .text("project_home", "项目主页")
            .build()?,
    )?;

    app.on_menu_event(|app, event| {
        handle_menu_event(app, &event);
    });

    Ok(())
}

pub fn handle_menu_event(app: &AppHandle, event: &MenuEvent) {
    let opener = app.opener();
    if event.id() == "report_issue" {
        let _ = opener.open_url("https://github.com/Yang-Qinghuayi/YSH/issues", None::<&str>);
    } else if event.id() == "project_home" {
        let _ = opener.open_url("https://github.com/Yang-Qinghuayi/YSH", None::<&str>);
    }
}
