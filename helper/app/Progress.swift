// Download progress in the menu bar: the ⤓ icon turns into a progress ring while
// songs are being saved, and the menu lists each one with its own progress bar.
import AppKit

struct Job {
    let id: String
    let state: String
    let progress: Double
    let title: String
    let file: String?
    let error: String?
    let created: Double
    let note: String?

    var active: Bool { ["queued", "downloading", "converting"].contains(state) }

    init?(_ j: [String: Any]) {
        guard let id = j["id"] as? String, let state = j["state"] as? String else { return nil }
        self.id = id
        self.state = state
        progress = j["progress"] as? Double ?? 0
        let meta = j["meta"] as? [String: Any]
        title = [meta?["artist"] as? String, meta?["title"] as? String].compactMap { $0 }.joined(separator: " – ")
        file = j["file"] as? String
        error = j["error"] as? String
        created = j["created"] as? Double ?? 0
        note = j["detail"] as? String
    }

    var detail: String {
        if let note, active { return note }
        switch state {
        case "queued": return "Waiting…"
        case "downloading": return "Downloading · \(Int(progress * 100))%"
        case "converting": return "Tagging…"
        default: return ""
        }
    }
}

/// A ring that fills as `progress` goes 0 → 1, with the down arrow inside. A template
/// image, so it matches light and dark menu bars.
func progressIcon(_ progress: Double) -> NSImage {
    let img = NSImage(size: NSSize(width: 18, height: 18), flipped: false) { rect in
        let c = NSPoint(x: rect.midX, y: rect.midY)
        let r: CGFloat = 7.3
        let track = NSBezierPath()
        track.appendArc(withCenter: c, radius: r, startAngle: 0, endAngle: 360)
        NSColor.black.withAlphaComponent(0.3).setStroke()
        track.lineWidth = 1.5
        track.stroke()
        let p = max(0.04, min(1, progress))
        let arc = NSBezierPath()
        arc.appendArc(withCenter: c, radius: r, startAngle: 90, endAngle: 90 - 360 * CGFloat(p), clockwise: true)
        NSColor.black.setStroke()
        arc.lineWidth = 2.2
        arc.lineCapStyle = .round
        arc.stroke()
        let arrow = NSBezierPath()
        arrow.move(to: NSPoint(x: c.x, y: c.y + 3.6))
        arrow.line(to: NSPoint(x: c.x, y: c.y - 3.2))
        arrow.move(to: NSPoint(x: c.x - 2.8, y: c.y - 0.4))
        arrow.line(to: NSPoint(x: c.x, y: c.y - 3.2))
        arrow.line(to: NSPoint(x: c.x + 2.8, y: c.y - 0.4))
        arrow.lineWidth = 1.5
        arrow.lineCapStyle = .round
        arrow.lineJoinStyle = .round
        arrow.stroke()
        return true
    }
    img.isTemplate = true
    return img
}

/// One song in the menu: its name, what it's doing, and a progress bar.
final class JobRow: NSView {
    let name = NSTextField(labelWithString: "")
    let detail = NSTextField(labelWithString: "")
    let bar = NSProgressIndicator()

    init() {
        super.init(frame: NSRect(x: 0, y: 0, width: 280, height: 50))
        name.font = .menuFont(ofSize: 13)
        name.lineBreakMode = .byTruncatingTail
        detail.font = .systemFont(ofSize: 11)
        detail.textColor = .secondaryLabelColor
        bar.style = .bar
        bar.controlSize = .small
        bar.minValue = 0
        bar.maxValue = 1
        for v in [name, detail, bar] as [NSView] {
            v.translatesAutoresizingMaskIntoConstraints = false
            addSubview(v)
        }
        NSLayoutConstraint.activate([
            name.leadingAnchor.constraint(equalTo: leadingAnchor, constant: 14),
            name.trailingAnchor.constraint(equalTo: trailingAnchor, constant: -14),
            name.topAnchor.constraint(equalTo: topAnchor, constant: 5),
            bar.leadingAnchor.constraint(equalTo: name.leadingAnchor),
            bar.trailingAnchor.constraint(equalTo: name.trailingAnchor),
            bar.topAnchor.constraint(equalTo: name.bottomAnchor, constant: 3),
            detail.leadingAnchor.constraint(equalTo: name.leadingAnchor),
            detail.topAnchor.constraint(equalTo: bar.bottomAnchor, constant: 1),
        ])
    }

    required init?(coder: NSCoder) { nil }

    func show(_ job: Job) {
        name.stringValue = job.title.isEmpty ? "Song" : job.title
        detail.stringValue = job.detail
        if job.state != "queued" {
            if bar.isIndeterminate { bar.stopAnimation(nil); bar.isIndeterminate = false }
            bar.doubleValue = job.progress
        } else if !bar.isIndeterminate {
            bar.isIndeterminate = true
            bar.startAnimation(nil)
        }
    }
}

/// Keeps the icon and the menu's "Saving" section in step with the helper's downloads.
final class DownloadsUI {
    let item: NSStatusItem
    let menu: NSMenu
    /// Menu items this section added (so they can be replaced).
    private var added: [NSMenuItem] = []
    private var rows: [String: JobRow] = [:]
    private var lastKey = ""
    var onReveal: ((String) -> Void)?

    init(item: NSStatusItem, menu: NSMenu) {
        self.item = item
        self.menu = menu
        let t = Timer(timeInterval: 0.5, repeats: true) { [weak self] _ in self?.poll() }
        // .common so it keeps updating while the menu is open.
        RunLoop.main.add(t, forMode: .common)
    }

    func poll() {
        call("/jobs") { [weak self] json in
            guard let self else { return }
            let jobs = (json?["jobs"] as? [[String: Any]] ?? []).compactMap(Job.init)
            self.render(jobs)
        }
    }

    private func render(_ jobs: [Job]) {
        let active = jobs.filter(\.active).sorted { $0.created < $1.created }
        let now = Date().timeIntervalSince1970 * 1000
        let recent = jobs.filter { !$0.active && now - $0.created < 30 * 60 * 1000 }.prefix(4)

        // The icon: a ring showing overall progress while saving.
        if let button = item.button {
            if active.isEmpty {
                if button.toolTip != "Curator Helper" {
                    let img = NSImage(systemSymbolName: "arrow.down.circle", accessibilityDescription: "Curator Helper")
                    img?.isTemplate = true
                    button.image = img
                    button.toolTip = "Curator Helper"
                }
            } else {
                let total = active.reduce(0.0) { $0 + $1.progress } / Double(active.count)
                button.image = progressIcon(total)
                button.toolTip = "Saving \(active.count) song\(active.count == 1 ? "" : "s") · \(Int(total * 100))%"
            }
        }

        // Only rebuild the menu section when the list itself changes; otherwise just update the rows.
        let key = (active.map(\.id) + recent.map { "\($0.id)\($0.state)" }).joined(separator: ",")
        if key == lastKey {
            for j in active { rows[j.id]?.show(j) }
            return
        }
        lastKey = key
        for i in added { menu.removeItem(i) }
        added = []
        var at = 1 // after the "Saving to …" line
        func add(_ i: NSMenuItem) {
            menu.insertItem(i, at: at)
            added.append(i)
            at += 1
        }
        if active.isEmpty && recent.isEmpty { return }
        add(.separator())
        if !active.isEmpty {
            let h = NSMenuItem(title: "Saving", action: nil, keyEquivalent: "")
            h.isEnabled = false
            add(h)
        }
        var keep: [String: JobRow] = [:]
        for j in active {
            let row = rows[j.id] ?? JobRow()
            row.show(j)
            keep[j.id] = row
            let i = NSMenuItem()
            i.view = row
            add(i)
        }
        rows = keep
        if !recent.isEmpty {
            let h = NSMenuItem(title: "Recently saved", action: nil, keyEquivalent: "")
            h.isEnabled = false
            add(h)
            for j in recent {
                let ok = j.state == "done"
                let i = NSMenuItem(title: "\(ok ? "✓" : "⚠︎") \(j.title.isEmpty ? "Song" : j.title)", action: ok ? #selector(reveal(_:)) : nil, keyEquivalent: "")
                i.target = self
                i.representedObject = j.id
                i.toolTip = ok ? "Show in Finder" : j.error
                i.isEnabled = ok
                add(i)
            }
        }
    }

    @objc func reveal(_ sender: NSMenuItem) {
        if let id = sender.representedObject as? String { call("/reveal", ["id": id]) }
    }
}
