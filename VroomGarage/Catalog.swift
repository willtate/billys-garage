import SceneKit
import UIKit

// MARK: - The saved car

struct CarDesign: Codable, Equatable {
    var body = "muscle"
    var wheels = "alloy"
    var paint = "blue"
    var sticker = "stripes"
    var engine = "none"
    var front = "none"
    var roof = "none"
    var back = "none"

    func addon(_ slot: AddonSlot) -> String {
        switch slot {
        case .engine: return engine
        case .front: return front
        case .roof: return roof
        case .back: return back
        }
    }

    mutating func setAddon(_ slot: AddonSlot, _ id: String) {
        switch slot {
        case .engine: engine = id
        case .front: front = id
        case .roof: roof = id
        case .back: back = id
        }
    }
}

enum AddonSlot: String, CaseIterable {
    case engine, front, roof, back
}

enum PartCategory: String, CaseIterable, Identifiable {
    case body, wheels, paint, sticker, engine, front, roof, back
    var id: String { rawValue }

    var slot: AddonSlot? { AddonSlot(rawValue: rawValue) }

    /// Fallback icon while the 3D picture of the category renders.
    var symbol: String {
        switch self {
        case .body: return "car.fill"
        case .wheels: return "circle.circle.fill"
        case .paint: return "paintbrush.fill"
        case .sticker: return "flame.fill"
        case .engine, .front, .roof, .back: return "wrench.and.screwdriver.fill"
        }
    }

    /// Which part's 3D picture to show on the category button (nil = use the symbol).
    var iconPart: String? {
        switch self {
        case .wheels: return "alloy"
        case .engine: return "blower"
        case .front: return "bullbar"
        case .roof: return "police"
        case .back: return "wing"
        default: return nil
        }
    }

    var tint: UIColor {
        switch self {
        case .body: return UIColor(red: 1.00, green: 0.48, blue: 0.13, alpha: 1)
        case .wheels: return UIColor(red: 0.16, green: 0.55, blue: 1.00, alpha: 1)
        case .paint: return UIColor(red: 0.95, green: 0.25, blue: 0.30, alpha: 1)
        case .sticker: return UIColor(red: 1.00, green: 0.72, blue: 0.05, alpha: 1)
        case .engine: return UIColor(red: 0.55, green: 0.58, blue: 0.64, alpha: 1)
        case .front: return UIColor(red: 0.18, green: 0.72, blue: 0.40, alpha: 1)
        case .roof: return UIColor(red: 0.58, green: 0.36, blue: 1.00, alpha: 1)
        case .back: return UIColor(red: 0.05, green: 0.70, blue: 0.80, alpha: 1)
        }
    }
}

// MARK: - Materials shared by one car

final class CarMaterials {
    let paint = SCNMaterial.pbr(.blue, metal: 0.3, rough: 0.35, clearCoat: true)
    let trim = SCNMaterial.pbr(UIColor(white: 0.07, alpha: 1), rough: 0.6)
    let plastic = SCNMaterial.pbr(UIColor(white: 0.12, alpha: 1), rough: 0.75)
    let grille = SCNMaterial.pbr(UIColor(white: 0.03, alpha: 1), rough: 0.5)
    let glass: SCNMaterial = {
        let g = SCNMaterial()
        g.lightingModel = .blinn
        g.diffuse.contents = UIColor(red: 0.03, green: 0.05, blue: 0.08, alpha: 0.9)
        g.specular.contents = UIColor(white: 1, alpha: 1)
        g.shininess = 90
        g.reflective.contents = studioEnvironment
        g.reflective.intensity = 0.95
        g.fresnelExponent = 1.4
        g.transparencyMode = .aOne
        g.blendMode = .alpha
        g.writesToDepthBuffer = false
        return g
    }()
    let chrome = SCNMaterial.pbr(UIColor(white: 0.96, alpha: 1), metal: 1.0, rough: 0.08)
    let alloy = SCNMaterial.pbr(UIColor(white: 0.78, alpha: 1), metal: 1.0, rough: 0.28)
    let gunmetal = SCNMaterial.pbr(UIColor(white: 0.22, alpha: 1), metal: 1.0, rough: 0.35)
    let rubber: SCNMaterial = {
        let m = SCNMaterial.pbr(UIColor(white: 0.075, alpha: 1), rough: 0.97)
        m.specular.contents = UIColor(white: 0.1, alpha: 1)
        return m
    }()
    let tread: SCNMaterial = {
        let m = SCNMaterial.pbr(.white, rough: 0.97)
        m.diffuse.contents = treadImage
        m.diffuse.wrapS = .repeat
        m.diffuse.wrapT = .repeat
        m.diffuse.contentsTransform = SCNMatrix4MakeScale(6, 1, 1)
        return m
    }()
    let white = SCNMaterial.pbr(UIColor(white: 0.97, alpha: 1), rough: 0.35)
    let gold = SCNMaterial.pbr(UIColor(red: 1.0, green: 0.78, blue: 0.3, alpha: 1), metal: 1.0, rough: 0.2)
    let yellow = SCNMaterial.pbr(UIColor(red: 1.0, green: 0.8, blue: 0.05, alpha: 1), rough: 0.35, clearCoat: true)
    let headlight = SCNMaterial.pbr(UIColor(red: 1.0, green: 0.98, blue: 0.9, alpha: 1), rough: 0.1,
                                     emission: UIColor(red: 1.0, green: 0.96, blue: 0.82, alpha: 1))
    let taillight = SCNMaterial.pbr(UIColor(red: 0.9, green: 0.05, blue: 0.05, alpha: 1), rough: 0.15,
                                     emission: UIColor(red: 0.85, green: 0.02, blue: 0.02, alpha: 1))
    let amber = SCNMaterial.pbr(UIColor(red: 1.0, green: 0.55, blue: 0.0, alpha: 1), rough: 0.15,
                                 emission: UIColor(red: 0.8, green: 0.35, blue: 0.0, alpha: 1))

    let caliper = SCNMaterial.pbr(UIColor(red: 0.85, green: 0.08, blue: 0.06, alpha: 1), rough: 0.3, clearCoat: true)
    /// Polished lamp reflector: bright silver with a faint glow so lamps read as lit.
    let reflector = SCNMaterial.pbr(UIColor(white: 0.92, alpha: 1), metal: 1.0, rough: 0.3,
                                    emission: UIColor(white: 0.32, alpha: 1))
    /// Clear lamp cover glass: mostly see-through, with a bright reflection.
    let lens: SCNMaterial = {
        let g = SCNMaterial()
        g.lightingModel = .blinn
        g.diffuse.contents = UIColor(white: 1, alpha: 0.1)
        g.specular.contents = UIColor.white
        g.shininess = 120
        g.reflective.contents = studioEnvironment
        g.reflective.intensity = 0.55
        g.fresnelExponent = 1.8
        g.transparencyMode = .aOne
        g.blendMode = .alpha
        g.writesToDepthBuffer = false
        return g
    }()
    /// Deep red tail-lamp cover over a brighter glowing core.
    let tailLens: SCNMaterial = {
        let g = SCNMaterial()
        g.lightingModel = .blinn
        g.diffuse.contents = UIColor(red: 0.75, green: 0.02, blue: 0.04, alpha: 0.72)
        g.emission.contents = UIColor(red: 0.35, green: 0.0, blue: 0.0, alpha: 1)
        g.specular.contents = UIColor.white
        g.shininess = 100
        g.reflective.contents = studioEnvironment
        g.reflective.intensity = 0.35
        g.fresnelExponent = 1.6
        g.transparencyMode = .aOne
        g.blendMode = .alpha
        return g
    }()

    /// Racing stripes: white on dark paint, near-black on light paint.
    let stripe = SCNMaterial.pbr(.white, rough: 0.3, clearCoat: true)
    /// Current paint, so stickers can pick a contrasting colour.
    private(set) var current = Catalog.paints[0]

    func setPaint(_ p: PaintStyle, animated: Bool) {
        current = p
        SCNTransaction.begin()
        SCNTransaction.animationDuration = animated ? 0.45 : 0
        paint.diffuse.contents = p.color
        paint.metalness.contents = p.metallic ? 0.9 : 0.3
        paint.roughness.contents = p.metallic ? 0.25 : 0.35
        stripe.diffuse.contents = p.isLight ? UIColor(white: 0.1, alpha: 1) : UIColor(white: 0.98, alpha: 1)
        SCNTransaction.commit()
    }
}

// MARK: - Part definitions

struct PaintStyle: Identifiable {
    let id: String
    let color: UIColor
    var metallic = false
    var isLight: Bool { ["white", "yellow", "silver", "gold", "orange", "lime"].contains(id) }
}

struct WheelStyle: Identifiable {
    let id: String
    let scale: Float
    let widthScale: Float
    /// Builds one wheel around the +Y axis (the axle). The hub face points to +Y.
    let build: (CarMaterials, CGFloat, CGFloat) -> SCNNode
}

struct AddonStyle: Identifiable {
    let id: String
    /// Builds the part at the body's anchor for its slot (nil = nothing fitted).
    let build: ((CarMaterials, BodyStyle) -> SCNNode)?
}

struct StickerStyle: Identifiable {
    let id: String
}

enum Catalog {
    static let paints: [PaintStyle] = [
        PaintStyle(id: "red", color: UIColor(red: 0.82, green: 0.04, blue: 0.05, alpha: 1)),
        PaintStyle(id: "orange", color: UIColor(red: 1.00, green: 0.42, blue: 0.02, alpha: 1)),
        PaintStyle(id: "yellow", color: UIColor(red: 1.00, green: 0.80, blue: 0.02, alpha: 1)),
        PaintStyle(id: "lime", color: UIColor(red: 0.45, green: 0.85, blue: 0.10, alpha: 1)),
        PaintStyle(id: "green", color: UIColor(red: 0.05, green: 0.42, blue: 0.18, alpha: 1)),
        PaintStyle(id: "army", color: UIColor(red: 0.30, green: 0.34, blue: 0.20, alpha: 1)),
        PaintStyle(id: "teal", color: UIColor(red: 0.02, green: 0.62, blue: 0.70, alpha: 1)),
        PaintStyle(id: "blue", color: UIColor(red: 0.05, green: 0.25, blue: 0.85, alpha: 1)),
        PaintStyle(id: "navy", color: UIColor(red: 0.04, green: 0.08, blue: 0.30, alpha: 1)),
        PaintStyle(id: "purple", color: UIColor(red: 0.40, green: 0.12, blue: 0.75, alpha: 1)),
        PaintStyle(id: "white", color: UIColor(white: 0.95, alpha: 1)),
        PaintStyle(id: "black", color: UIColor(white: 0.04, alpha: 1)),
        PaintStyle(id: "silver", color: UIColor(white: 0.80, alpha: 1), metallic: true),
        PaintStyle(id: "gold", color: UIColor(red: 0.95, green: 0.70, blue: 0.25, alpha: 1), metallic: true),
    ]

    static let stickers: [StickerStyle] = ["none", "stripes", "flames", "lightning", "checker", "number"].map { StickerStyle(id: $0) }

    static func body(_ id: String) -> BodyStyle { bodies.first { $0.id == id } ?? bodies[0] }
    static func wheel(_ id: String) -> WheelStyle { wheels.first { $0.id == id } ?? wheels[0] }
    static func paint(_ id: String) -> PaintStyle { paints.first { $0.id == id } ?? paints[0] }
    static func addons(_ slot: AddonSlot) -> [AddonStyle] {
        switch slot {
        case .engine: return engineParts
        case .front: return frontParts
        case .roof: return roofParts
        case .back: return backParts
        }
    }
    static func addon(_ slot: AddonSlot, _ id: String) -> AddonStyle {
        addons(slot).first { $0.id == id } ?? addons(slot)[0]
    }
}

// MARK: - Generated textures

/// A dim workshop with bright soft-box lights, used for reflections on paint, chrome and glass.
let studioEnvironment: UIImage = {
    let size = CGSize(width: 1024, height: 512)
    return UIGraphicsImageRenderer(size: size).image { ctx in
        let c = ctx.cgContext
        let colors = [UIColor(white: 0.55, alpha: 1).cgColor, UIColor(white: 0.30, alpha: 1).cgColor,
                      UIColor(white: 0.20, alpha: 1).cgColor, UIColor(white: 0.12, alpha: 1).cgColor] as CFArray
        let grad = CGGradient(colorsSpace: CGColorSpaceCreateDeviceRGB(), colors: colors, locations: [0, 0.4, 0.55, 1])!
        c.drawLinearGradient(grad, start: .zero, end: CGPoint(x: 0, y: size.height), options: [])
        // Long strip lights overhead and soft boxes around the horizon.
        c.setFillColor(UIColor.white.cgColor)
        for i in 0..<4 {
            c.fill(CGRect(x: CGFloat(i) * 256 + 40, y: 40, width: 170, height: 22))
            c.fill(CGRect(x: CGFloat(i) * 256 + 70, y: 120, width: 110, height: 16))
        }
        c.setFillColor(UIColor(white: 0.95, alpha: 1).cgColor)
        for i in 0..<3 {
            c.fill(CGRect(x: CGFloat(i) * 340 + 60, y: 200, width: 120, height: 50))
        }
        c.setFillColor(UIColor(red: 1.0, green: 0.85, blue: 0.6, alpha: 0.6).cgColor)
        c.fill(CGRect(x: 0, y: 252, width: size.width, height: 6))
    }
}()

/// Tyre tread: dark rubber with chunky grooves, wrapped round the tyre.
let treadImage: UIImage = {
    let size = CGSize(width: 64, height: 64)
    return UIGraphicsImageRenderer(size: size).image { ctx in
        let c = ctx.cgContext
        c.setFillColor(UIColor(white: 0.12, alpha: 1).cgColor)
        c.fill(CGRect(origin: .zero, size: size))
        c.setFillColor(UIColor(white: 0.03, alpha: 1).cgColor)
        // Chevron blocks: each V spans the tread width (v) and they repeat round the tyre (u).
        for col in [CGFloat(8), 40] {
            let p = UIBezierPath()
            p.move(to: CGPoint(x: col, y: 0))
            p.addLine(to: CGPoint(x: col + 10, y: 32))
            p.addLine(to: CGPoint(x: col, y: 64))
            p.addLine(to: CGPoint(x: col + 7, y: 64))
            p.addLine(to: CGPoint(x: col + 17, y: 32))
            p.addLine(to: CGPoint(x: col + 7, y: 0))
            p.close()
            c.addPath(p.cgPath)
            c.fillPath()
        }
        c.fill(CGRect(x: 0, y: 30, width: 64, height: 4))
    }
}()
