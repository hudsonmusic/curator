// Curator Helper's app: a tiny native Mac app that runs the helper server
// (and keeps itself up to date: see Updater.swift)
// (Contents/MacOS/curator-helper-server) and shows a menu bar icon.
// macOS needs a real app here; a plain background program shows as "not responding".
//
// It also opens curator-helper:// links, which is how Safari hands songs over:
// Safari won't let a secure site call the helper's local address directly.
//   curator-helper://save?d=<base64url of {"url": "...", "meta": {...}}>
import AppKit
import UserNotifications

let port = 47533
let base = "http://127.0.0.1:\(port)"

/// A small JSON request to the helper server (from this Mac, so always allowed).
func call(_ path: String, _ body: [String: Any]? = nil, done: (([String: Any]?) -> Void)? = nil) {
    var req = URLRequest(url: URL(string: "\(base)\(path)")!)
    req.timeoutInterval = 10
    if let body {
        req.httpMethod = "POST"
        req.setValue("application/json", forHTTPHeaderField: "content-type")
        req.httpBody = try? JSONSerialization.data(withJSONObject: body)
    }
    URLSession.shared.dataTask(with: req) { data, _, _ in
        let json = data.flatMap { try? JSONSerialization.jsonObject(with: $0) as? [String: Any] }
        DispatchQueue.main.async { done?(json) }
    }.resume()
}

final class AppDelegate: NSObject, NSApplicationDelegate, NSMenuDelegate, UNUserNotificationCenterDelegate {
    var server: Process?
    var item: NSStatusItem!
    var quitting = false
    var ready = false
    var pending: [URL] = []
    let status = NSMenuItem(title: "Curator Helper is running", action: nil, keyEquivalent: "")
    let formats: [(String, String)] = [("mp3", "MP3"), ("aiff", "AIFF"), ("wav", "WAV")]
    var formatItems: [NSMenuItem] = []
    let updateItem = NSMenuItem(title: "Check for Updates…", action: nil, keyEquivalent: "")
    let autoItem = NSMenuItem(title: "Install Updates Automatically", action: nil, keyEquivalent: "")

    func applicationDidFinishLaunching(_ note: Notification) {
        // Only one copy at a time.
        let me = NSRunningApplication.current
        if NSRunningApplication.runningApplications(withBundleIdentifier: Bundle.main.bundleIdentifier ?? "")
            .contains(where: { $0.processIdentifier != me.processIdentifier }) {
            openStatusPage()
            NSApp.terminate(nil)
            return
        }
        UNUserNotificationCenter.current().delegate = self
        setUpMenu()
        startServer()
        waitForServer(tries: 40)
        let updater = Updater.shared
        updater.notify = { [weak self] title, body in self?.notify(title, body) }
        updater.onChange = { [weak self] in self?.refreshUpdateItem() }
        updater.start()
    }

    // MARK: Server

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

    /// Links can arrive before the server is listening; hold them until it is.
    func waitForServer(tries: Int) {
        call("/status") { [weak self] json in
            guard let self else { return }
            if json?["app"] as? String == "curator-helper" {
                self.ready = true
                let urls = self.pending
                self.pending = []
                urls.forEach(self.handle)
            } else if tries > 0 {
                DispatchQueue.main.asyncAfter(deadline: .now() + 0.25) { self.waitForServer(tries: tries - 1) }
            }
        }
    }

    // MARK: curator-helper:// links

    func application(_ application: NSApplication, open urls: [URL]) {
        for url in urls {
            if ready { handle(url) } else { pending.append(url) }
        }
    }

    func handle(_ url: URL) {
        guard url.scheme == "curator-helper" else { return }
        switch url.host ?? "" {
        case "save":
            guard let d = URLComponents(url: url, resolvingAgainstBaseURL: false)?.queryItems?.first(where: { $0.name == "d" })?.value,
                  let data = base64url(d),
                  let body = try? JSONSerialization.jsonObject(with: data) as? [String: Any] else { return }
            save(body)
        default:
            openStatusPage()
        }
    }

    func base64url(_ s: String) -> Data? {
        var b = s.replacingOccurrences(of: "-", with: "+").replacingOccurrences(of: "_", with: "/")
        while b.count % 4 != 0 { b += "=" }
        return Data(base64Encoded: b)
    }

    func save(_ body: [String: Any]) {
        askForNotifications()
        let meta = body["meta"] as? [String: Any]
        let name = [meta?["artist"] as? String, meta?["title"] as? String].compactMap { $0 }.joined(separator: " – ")
        call("/download", body) { [weak self] json in
            guard let job = json?["job"] as? [String: Any], let id = job["id"] as? String else {
                self?.notify("Couldn't save \(name.isEmpty ? "that song" : name)", (json?["error"] as? String) ?? "The helper didn't accept it.")
                return
            }
            self?.follow(id, name: name)
        }
    }

    /// Checks on a download until it's done, then says so.
    func follow(_ id: String, name: String, tries: Int = 600) {
        call("/jobs/\(id)") { [weak self] json in
            guard let self, let job = json?["job"] as? [String: Any] else { return }
            switch job["state"] as? String {
            case "done":
                let file = (job["file"] as? String).map { ($0 as NSString).lastPathComponent } ?? name
                self.notify("Saved for Ableton", file, jobId: id)
            case "error":
                self.notify("Couldn't save \(name.isEmpty ? "that song" : name)", (job["error"] as? String) ?? "")
            default:
                if tries > 0 {
                    DispatchQueue.main.asyncAfter(deadline: .now() + 1) { self.follow(id, name: name, tries: tries - 1) }
                }
            }
        }
    }

    // MARK: Notifications (from Curator Helper itself)

    func askForNotifications() {
        UNUserNotificationCenter.current().requestAuthorization(options: [.alert, .sound]) { _, _ in }
    }

    func notify(_ title: String, _ body: String, jobId: String? = nil) {
        askForNotifications()
        let c = UNMutableNotificationContent()
        c.title = title
        c.body = body
        if let jobId { c.userInfo = ["job": jobId] }
        UNUserNotificationCenter.current().add(UNNotificationRequest(identifier: UUID().uuidString, content: c, trigger: nil))
    }

    // Clicking "Saved" shows the file in Finder.
    func userNotificationCenter(_ center: UNUserNotificationCenter, didReceive response: UNNotificationResponse, withCompletionHandler done: @escaping () -> Void) {
        if let id = response.notification.request.content.userInfo["job"] as? String { call("/reveal", ["id": id]) }
        done()
    }

    func userNotificationCenter(_ center: UNUserNotificationCenter, willPresent notification: UNNotification, withCompletionHandler done: @escaping (UNNotificationPresentationOptions) -> Void) {
        done([.banner, .list])
    }

    // MARK: Menu bar

    func setUpMenu() {
        item = NSStatusBar.system.statusItem(withLength: NSStatusItem.squareLength)
        if let button = item.button {
            let img = NSImage(systemSymbolName: "arrow.down.circle", accessibilityDescription: "Curator Helper")
            img?.isTemplate = true
            button.image = img
            button.toolTip = "Curator Helper"
        }
        let menu = NSMenu()
        menu.delegate = self
        status.isEnabled = false
        menu.addItem(status)
        menu.addItem(.separator())
        menu.addItem(withTitle: "Open Songs Folder", action: #selector(openFolder), keyEquivalent: "o").target = self
        menu.addItem(withTitle: "Change Save Folder…", action: #selector(changeFolder), keyEquivalent: "").target = self
        let formatMenu = NSMenu()
        for (id, label) in formats {
            let f = NSMenuItem(title: label, action: #selector(setFormat(_:)), keyEquivalent: "")
            f.target = self
            f.representedObject = id
            formatMenu.addItem(f)
            formatItems.append(f)
        }
        let formatItem = NSMenuItem(title: "Format", action: nil, keyEquivalent: "")
        formatItem.submenu = formatMenu
        menu.addItem(formatItem)
        menu.addItem(withTitle: "Status…", action: #selector(openStatus), keyEquivalent: "").target = self
        menu.addItem(.separator())
        updateItem.target = self
        updateItem.action = #selector(checkForUpdates)
        menu.addItem(updateItem)
        autoItem.target = self
        autoItem.action = #selector(toggleAutoUpdate)
        menu.addItem(autoItem)
        refreshUpdateItem()
        menu.addItem(.separator())
        menu.addItem(withTitle: "Quit Curator Helper", action: #selector(quit), keyEquivalent: "q").target = self
        item.menu = menu
    }

    // Show the current folder and format whenever the menu opens.
    func menuWillOpen(_ menu: NSMenu) {
        call("/status") { [weak self] json in
            guard let self else { return }
            if let folder = json?["folder"] as? String {
                self.status.title = "Saving to \((folder as NSString).lastPathComponent)"
            }
            let format = json?["format"] as? String ?? "mp3"
            for f in self.formatItems { f.state = (f.representedObject as? String) == format ? .on : .off }
        }
    }

    // MARK: Updates

    func refreshUpdateItem() {
        let u = Updater.shared
        autoItem.state = u.automatic ? .on : .off
        switch u.state {
        case .checking: updateItem.title = "Checking for Updates…"; updateItem.isEnabled = false
        case .downloading(let v): updateItem.title = "Downloading \(v)…"; updateItem.isEnabled = false
        case .installing(let v): updateItem.title = "Installing \(v)…"; updateItem.isEnabled = false
        default:
            updateItem.isEnabled = true
            updateItem.title = u.available.map { "Update to \($0.version)" } ?? "Check for Updates… (version \(u.current))"
        }
    }

    @objc func checkForUpdates() {
        let u = Updater.shared
        if let r = u.available { u.install(r) } else { u.check(userAsked: true) }
    }

    @objc func toggleAutoUpdate() {
        Updater.shared.automatic.toggle()
        refreshUpdateItem()
    }

    @objc func setFormat(_ sender: NSMenuItem) {
        guard let id = sender.representedObject as? String else { return }
        call("/settings", ["format": id])
    }

    @objc func openFolder() { call("/open-folder", [:]) }

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
        call("/folder", ["folder": url.path]) { json in
            guard json?["error"] != nil else { return }
            let alert = NSAlert()
            alert.messageText = "Pick a folder inside your home folder."
            alert.runModal()
        }
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
