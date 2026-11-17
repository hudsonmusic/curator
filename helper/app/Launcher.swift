// Curator Helper's app: a tiny native Mac app that runs the helper server
// (Contents/MacOS/curator-helper-server) and shows a menu bar icon.
// macOS needs a real app here; a plain background program shows as "not responding".
import AppKit

let port = 47533
let base = "http://127.0.0.1:\(port)"

final class AppDelegate: NSObject, NSApplicationDelegate {
    var server: Process?
    var item: NSStatusItem!
    var quitting = false

    func applicationDidFinishLaunching(_ note: Notification) {
        // Only one copy at a time.
        let me = NSRunningApplication.current
        if NSRunningApplication.runningApplications(withBundleIdentifier: Bundle.main.bundleIdentifier ?? "")
            .contains(where: { $0.processIdentifier != me.processIdentifier }) {
            openStatusPage()
            NSApp.terminate(nil)
            return
        }
        setUpMenu()
        startServer()
    }

    func startServer() {
        guard let exe = Bundle.main.url(forAuxiliaryExecutable: "curator-helper-server") else { return }
        let p = Process()
        p.executableURL = exe
        var env = ProcessInfo.processInfo.environment
        env["CURATOR_APP_EXEC"] = Bundle.main.executablePath ?? ""
        p.environment = env
        p.standardOutput = FileHandle.nullDevice
        p.standardError = FileHandle.nullDevice
        p.terminationHandler = { [weak self] _ in
            // The server quit (e.g. Quit in curator's Settings): quit the app too.
            DispatchQueue.main.async { if self?.quitting == false { NSApp.terminate(nil) } }
        }
        do { try p.run(); server = p } catch { NSApp.terminate(nil) }
    }

    func setUpMenu() {
        item = NSStatusBar.system.statusItem(withLength: NSStatusItem.squareLength)
        if let button = item.button {
            let img = NSImage(systemSymbolName: "arrow.down.circle", accessibilityDescription: "Curator Helper")
            img?.isTemplate = true
            button.image = img
            button.toolTip = "Curator Helper"
        }
        let menu = NSMenu()
        let title = NSMenuItem(title: "Curator Helper is running", action: nil, keyEquivalent: "")
        title.isEnabled = false
        menu.addItem(title)
        menu.addItem(.separator())
        menu.addItem(withTitle: "Open Songs Folder", action: #selector(openFolder), keyEquivalent: "o").target = self
        menu.addItem(withTitle: "Change Save Folder…", action: #selector(changeFolder), keyEquivalent: "").target = self
        menu.addItem(withTitle: "Status…", action: #selector(openStatus), keyEquivalent: "").target = self
        menu.addItem(.separator())
        menu.addItem(withTitle: "Quit Curator Helper", action: #selector(quit), keyEquivalent: "q").target = self
        item.menu = menu
    }

    @objc func openFolder() {
        var req = URLRequest(url: URL(string: "\(base)/open-folder")!)
        req.httpMethod = "POST"
        req.setValue("application/json", forHTTPHeaderField: "content-type")
        req.httpBody = Data("{}".utf8)
        URLSession.shared.dataTask(with: req).resume()
    }

    @objc func openStatus() { openStatusPage() }

    /// The standard Mac folder picker; the choice goes to the server.
    @objc func changeFolder() {
        NSApp.activate(ignoringOtherApps: true)
        let panel = NSOpenPanel()
        panel.title = "Where should Curator Helper save songs?"
        panel.prompt = "Save Here"
        panel.canChooseFiles = false
        panel.canChooseDirectories = true
        panel.canCreateDirectories = true
        panel.directoryURL = FileManager.default.urls(for: .downloadsDirectory, in: .userDomainMask).first
        guard panel.runModal() == .OK, let url = panel.url else { return }
        var req = URLRequest(url: URL(string: "\(base)/folder")!)
        req.httpMethod = "POST"
        req.setValue("application/json", forHTTPHeaderField: "content-type")
        req.httpBody = try? JSONSerialization.data(withJSONObject: ["folder": url.path])
        URLSession.shared.dataTask(with: req) { data, _, _ in
            guard let data, let text = String(data: data, encoding: .utf8), text.contains("error") else { return }
            DispatchQueue.main.async {
                let alert = NSAlert()
                alert.messageText = "Pick a folder inside your home folder."
                alert.runModal()
            }
        }.resume()
    }

    func openStatusPage() {
        NSWorkspace.shared.open(URL(string: "\(base)/")!)
    }

    @objc func quit() { NSApp.terminate(nil) }

    // Opening the app again while it runs shows the status page.
    func applicationShouldHandleReopen(_ sender: NSApplication, hasVisibleWindows flag: Bool) -> Bool {
        openStatusPage()
        return false
    }

    func applicationWillTerminate(_ note: Notification) {
        quitting = true
        server?.terminate()
    }
}

let app = NSApplication.shared
let delegate = AppDelegate()
app.delegate = delegate
app.setActivationPolicy(.accessory)
app.run()
