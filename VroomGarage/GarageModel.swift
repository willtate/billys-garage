import SwiftUI
import UIKit

final class GarageModel: ObservableObject {
    @Published private(set) var design: CarDesign
    @Published var category: PartCategory = .body
    @Published private(set) var thumbs: [String: UIImage] = [:]

    let scene = GarageScene()
    private let thumbnailer = ThumbnailRenderer()
    private var pending = Set<String>()
    private static let storeKey = "savedCar.v1"
    static let thumbSize: CGFloat = 132

    init() {
        if let data = UserDefaults.standard.data(forKey: Self.storeKey),
           let saved = try? JSONDecoder().decode(CarDesign.self, from: data) {
            design = saved
        } else {
            design = CarDesign()
        }
        scene.apply(design, previous: nil)
        SoundFX.shared.warmUp()
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

    func thumbnail(body id: String) -> UIImage? {
        var d = design
        d.body = id
        d.topper = "none"
        return thumb("body|\(id)|\(d.wheels)|\(d.paint)") { [thumbnailer] in thumbnailer.car(d, size: Self.thumbSize) }
    }

    func thumbnail(wheel id: String) -> UIImage? {
        let paint = design.paint
        return thumb("wheel|\(id)|\(paint)") { [thumbnailer] in thumbnailer.wheel(id, paint: paint, size: Self.thumbSize) }
    }

    func thumbnail(topper id: String) -> UIImage? {
        let paint = design.paint
        return thumb("topper|\(id)|\(paint)") { [thumbnailer] in thumbnailer.topper(id, paint: paint, size: Self.thumbSize) }
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
