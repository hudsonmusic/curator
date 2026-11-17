// Curator Helper's auto-updater.
//
// Every few hours it asks GitHub for the newest "helper-v*" release. When there's a
// newer version it downloads the disk image for this Mac (Apple silicon or Intel),
// checks it against GitHub's SHA-256 and the app's signature and bundle id, swaps
// the app in place and starts the new one. It waits while songs are downloading.
import AppKit
import CryptoKit

let repo = "hudsonmusic/curator"

struct Release {
    let version: String
    let dmg: URL
    let sha256: String?
    let page: URL
}

/// "1.10.0" > "1.9.2"
func isNewer(_ a: String, than b: String) -> Bool {
    let pa = a.split(separator: ".").map { Int($0) ?? 0 }, pb = b.split(separator: ".").map { Int($0) ?? 0 }
    for i in 0..<max(pa.count, pb.count) {
        let x = i < pa.count ? pa[i] : 0, y = i < pb.count ? pb[i] : 0
        if x != y { return x > y }
    }
    return false
}

final class Updater {
    enum State: Equatable { case idle, checking, downloading(String), installing(String), failed(String) }

    static let shared = Updater()
    let current = Bundle.main.object(forInfoDictionaryKey: "CFBundleShortVersionString") as? String ?? "0"
    #if arch(arm64)
    let arch = "arm64"
    #else
    let arch = "x64"
    #endif
    var state: State = .idle { didSet { DispatchQueue.main.async { self.onChange?() } } }
    var available: Release?
    var onChange: (() -> Void)?
    var notify: ((String, String) -> Void)?
    private var timer: Timer?

    /// On by default; "Install Updates Automatically" in the menu.
    var automatic: Bool {
        get { UserDefaults.standard.object(forKey: "autoUpdate") as? Bool ?? true }
        set { UserDefaults.standard.set(newValue, forKey: "autoUpdate") }
    }

    /// Where releases are listed (a defaults override is used for testing).
    var feed: URL {
        if let s = UserDefaults.standard.string(forKey: "updateFeed"), let u = URL(string: s) { return u }
        return URL(string: "https://api.github.com/repos/\(repo)/releases?per_page=20")!
    }

    func start() {
        // Say so after an update.
        let last = UserDefaults.standard.string(forKey: "lastVersion")
        if let last, isNewer(current, than: last) { notify?("Curator Helper updated", "Now on version \(current).") }
        UserDefaults.standard.set(current, forKey: "lastVersion")

        DispatchQueue.main.asyncAfter(deadline: .now() + 20) { self.check(userAsked: false) }
        timer = Timer.scheduledTimer(withTimeInterval: 6 * 3600, repeats: true) { _ in self.check(userAsked: false) }
    }

    func check(userAsked: Bool) {
        if case .downloading = state { return }
        if case .installing = state { return }
        state = .checking
        var req = URLRequest(url: feed)
        req.setValue("application/vnd.github+json", forHTTPHeaderField: "Accept")
        req.setValue("Curator-Helper/\(current)", forHTTPHeaderField: "User-Agent")
        req.timeoutInterval = 20
        URLSession.shared.dataTask(with: req) { data, _, _ in
            let release = data.flatMap { self.newest(from: $0) }
            DispatchQueue.main.async {
                self.state = .idle
                guard let release, isNewer(release.version, than: self.current) else {
                    self.available = nil
                    if userAsked { self.notify?("Curator Helper is up to date", "Version \(self.current) is the newest.") }
                    return
                }
                self.available = release
                if self.automatic || userAsked { self.install(release) }
                else { self.notify?("Curator Helper \(release.version) is out", "Choose Update in its menu bar icon.") }
            }
        }.resume()
    }

    /// The newest published helper release with a disk image for this Mac.
    private func newest(from data: Data) -> Release? {
        guard let list = try? JSONSerialization.jsonObject(with: data) as? [[String: Any]] else { return nil }
        for r in list {
            guard let tag = r["tag_name"] as? String, tag.hasPrefix("helper-v"),
                  r["draft"] as? Bool != true, r["prerelease"] as? Bool != true,
                  let assets = r["assets"] as? [[String: Any]],
                  let asset = assets.first(where: { ($0["name"] as? String) == "Curator-Helper-mac-\(arch).dmg" }),
                  let dl = (asset["browser_download_url"] as? String).flatMap(URL.init(string:)) else { continue }
            let digest = (asset["digest"] as? String).flatMap { $0.hasPrefix("sha256:") ? String($0.dropFirst(7)) : nil }
            let page = (r["html_url"] as? String).flatMap(URL.init(string:)) ?? URL(string: "https://github.com/\(repo)/releases")!
            return Release(version: String(tag.dropFirst("helper-v".count)), dmg: dl, sha256: digest, page: page)
        }
        return nil
    }

    func install(_ r: Release) {
        // Not while songs are being saved: try again in 10 minutes.
        call("/jobs") { json in
            let busy = (json?["jobs"] as? [[String: Any]] ?? []).contains { ["queued", "downloading", "converting"].contains($0["state"] as? String ?? "") }
            if busy {
                DispatchQueue.main.asyncAfter(deadline: .now() + 600) { self.install(r) }
                return
            }
            self.download(r)
        }
    }

    private func download(_ r: Release) {
        let app = Bundle.main.bundleURL
        let parent = app.deletingLastPathComponent()
        // Can't replace it here (e.g. not an admin): send them to the download instead.
        guard FileManager.default.isWritableFile(atPath: parent.path), FileManager.default.isWritableFile(atPath: app.path) else {
            notify?("Curator Helper \(r.version) is out", "Download it from GitHub to update.")
            NSWorkspace.shared.open(r.page)
            return
        }
        state = .downloading(r.version)
        URLSession.shared.downloadTask(with: r.dmg) { tmp, _, err in
            guard let tmp, err == nil else { return self.fail("Couldn't download the update.") }
            do {
                let dmg = FileManager.default.temporaryDirectory.appendingPathComponent("curator-helper-\(r.version).dmg")
                try? FileManager.default.removeItem(at: dmg)
                try FileManager.default.moveItem(at: tmp, to: dmg)
                if let want = r.sha256 {
                    let got = SHA256.hash(data: try Data(contentsOf: dmg)).map { String(format: "%02x", $0) }.joined()
                    guard got == want.lowercased() else { return self.fail("The update didn't match its checksum.") }
                }
                self.state = .installing(r.version)
                try self.swap(dmg: dmg, into: app, version: r.version)
            } catch {
                self.fail("Couldn't install the update.")
            }
        }.resume()
    }

    @discardableResult
    private func run(_ path: String, _ args: [String]) -> (Int32, String) {
        let p = Process()
        p.executableURL = URL(fileURLWithPath: path)
        p.arguments = args
        let out = Pipe()
        p.standardOutput = out
        p.standardError = FileHandle.nullDevice
        do { try p.run() } catch { return (-1, "") }
        let data = out.fileHandleForReading.readDataToEndOfFile()
        p.waitUntilExit()
        return (p.terminationStatus, String(data: data, encoding: .utf8) ?? "")
    }

    /// Mounts the image, checks the new app, stages it beside this one, then a tiny
    /// script swaps them once this app has quit and opens the new one.
    private func swap(dmg: URL, into app: URL, version: String) throws {
        let mount = FileManager.default.temporaryDirectory.appendingPathComponent("curator-helper-mount-\(UUID().uuidString)")
        try FileManager.default.createDirectory(at: mount, withIntermediateDirectories: true)
        guard run("/usr/bin/hdiutil", ["attach", "-nobrowse", "-readonly", "-noautoopen", "-mountpoint", mount.path, dmg.path]).0 == 0 else {
            return fail("Couldn't open the update.")
        }
        defer {
            run("/usr/bin/hdiutil", ["detach", "-quiet", mount.path])
            try? FileManager.default.removeItem(at: dmg)
        }
        let newApp = mount.appendingPathComponent("Curator Helper.app")
        let info = NSDictionary(contentsOf: newApp.appendingPathComponent("Contents/Info.plist"))
        guard info?["CFBundleIdentifier"] as? String == Bundle.main.bundleIdentifier,
              (info?["CFBundleShortVersionString"] as? String).map({ isNewer($0, than: current) }) == true,
              run("/usr/bin/codesign", ["--verify", "--deep", newApp.path]).0 == 0 else {
            return fail("The update didn't check out.")
        }
        let staged = app.deletingLastPathComponent().appendingPathComponent(".Curator Helper \(version).app")
        try? FileManager.default.removeItem(at: staged)
        guard run("/usr/bin/ditto", [newApp.path, staged.path]).0 == 0 else { return fail("Couldn't copy the update.") }

        let script = """
        while kill -0 "$1" 2>/dev/null; do sleep 0.2; done
        sleep 0.5
        rm -rf "$3.old"
        if mv "$3" "$3.old" && mv "$2" "$3"; then rm -rf "$3.old"; else rm -rf "$3"; mv "$3.old" "$3"; fi
        /usr/bin/open "$3"
        """
        let p = Process()
        p.executableURL = URL(fileURLWithPath: "/bin/sh")
        p.arguments = ["-c", script, "curator-helper-update", String(ProcessInfo.processInfo.processIdentifier), staged.path, app.path]
        p.standardOutput = FileHandle.nullDevice
        p.standardError = FileHandle.nullDevice
        try p.run()
        DispatchQueue.main.async { NSApp.terminate(nil) }
    }

    private func fail(_ message: String) {
        state = .failed(message)
        notify?("Curator Helper couldn't update", message)
    }
}
