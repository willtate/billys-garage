import SwiftUI
import UIKit

final class GarageModel: ObservableObject {
    @Published private(set) var design: CarDesign
    @Published var category: PartCategory = .body
    @Published private(set) var thumbs: [String: UIImage] = [:]

    let scene = GarageScene()
    private let thumbnailer = ThumbnailRenderer()
    private var pending = Set<String>()
    private static let storeKey = "savedCar.v2"
    static let thumbSize: CGFloat = 160

    init() {
        if let data = UserDefaults.standard.data(forKey: Self.storeKey),
           let saved = try? JSONDecoder().decode(CarDesign.self, from: data) {
            design = saved
        } else {
            design = CarDesign()
        }
        // Screenshot hooks: -vgDesign body=pickup,wheels=offroad,roof=lightbar  -vgCategory paint
        let args = ProcessInfo.processInfo.arguments
        if let i = args.firstIndex(of: "-vgDesign"), i + 1 < args.count {
            var d = CarDesign()
            for pair in args[i + 1].split(separator: ",") {
                let kv = pair.split(separator: "=").map(String.init)
                guard kv.count == 2 else { continue }
                switch kv[0] {
                case "body": d.body = kv[1]
                case "wheels": d.wheels = kv[1]
                case "paint": d.paint = kv[1]
                case "sticker": d.sticker = kv[1]
                default: if let slot = AddonSlot(rawValue: kv[0]) { d.setAddon(slot, kv[1]) }
                }
            }
            design = d
        }
        if let i = args.firstIndex(of: "-vgCategory"), i + 1 < args.count,
           let c = PartCategory(rawValue: args[i + 1]) {
            category = c
        }
        scene.apply(design, previous: nil)
        SoundFX.shared.warmUp()
        if args.contains("-vgAutoGo") {
            DispatchQueue.main.asyncAfter(deadline: .now() + 2) { [weak self] in self?.vroom() }
        }
    }

    func update(_ change: (inout CarDesign) -> Void) {
        var next = design
        change(&next)
        guard next != design else {
            scene.honk()   // tapping what you already have still does something fun
            return
        }
        let previous = design
        design = next
        scene.apply(next, previous: previous)
        if let data = try? JSONEncoder().encode(next) {
            UserDefaults.standard.set(data, forKey: Self.storeKey)
        }
    }

    func pick(_ category: PartCategory) {
        guard category != self.category else { return }
        SoundFX.shared.play(.click)
        self.category = category
    }

    func vroom() { scene.vroom() }
    func honk() { scene.honk() }

    // MARK: Thumbnails (rendered lazily, cached per look)

    /// Picture for one choice in a category: the whole car wearing that choice, seen from the side that shows it.
    func thumbnail(_ cat: PartCategory, _ id: String) -> UIImage? {
        var d = design
        var dir = V(0.78, 0.42, 0.95)
        switch cat {
        case .body:
            d.body = id
            d.engine = "none"; d.front = "none"; d.roof = "none"; d.back = "none"
        case .wheels:
            let paint = design.paint
            return thumb("wheel|\(id)|\(paint)") { [thumbnailer] in thumbnailer.wheel(id, paint: paint, size: Self.thumbSize) }
        case .paint:
            return nil
        case .sticker:
            d.sticker = id
            dir = V(0.25, 0.3, 1.0)
        case .engine, .front, .roof, .back:
            let slot = cat.slot!
            d.setAddon(slot, id)
            switch slot {
            case .back: dir = V(-0.85, 0.5, 0.9)
            case .roof, .engine: dir = V(0.8, 0.8, 0.7)
            case .front: dir = V(1.0, 0.3, 0.75)
            }
        }
        let key = "\(cat.rawValue)|\(id)|\(d.body)|\(d.wheels)|\(d.paint)|\(d.sticker)|\(d.engine)|\(d.front)|\(d.roof)|\(d.back)"
        return thumb(key) { [thumbnailer] in thumbnailer.car(d, size: Self.thumbSize, direction: dir) }
    }

    /// Picture for a category button (a wheel, or one bolt-on part on its own).
    func categoryIcon(_ cat: PartCategory) -> UIImage? {
        guard let part = cat.iconPart else { return nil }
        let paint = design.paint
        if cat == .wheels {
            return thumb("icon|wheel|\(paint)") { [thumbnailer] in thumbnailer.wheel(part, paint: paint, size: 96) }
        }
        guard let slot = cat.slot else { return nil }
        return thumb("icon|\(cat.rawValue)|\(paint)") { [thumbnailer] in thumbnailer.addon(slot, part, paint: paint, size: 96) }
    }

    private func thumb(_ key: String, render: @escaping () -> UIImage?) -> UIImage? {
        if let img = thumbs[key] { return img }
        if !pending.contains(key) {
            pending.insert(key)
            DispatchQueue.main.async { [weak self] in
                guard let self = self else { return }
                if let img = render() { self.thumbs[key] = img }
            }
        }
        return nil
    }
}
