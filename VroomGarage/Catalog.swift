import SceneKit
import UIKit

// MARK: - The saved car

struct CarDesign: Codable, Equatable {
    var body = "racer"
    var wheels = "classic"
    var paint = "red"
    var topper = "none"
}

enum PartCategory: String, CaseIterable, Identifiable {
    case body, wheels, paint, topper
    var id: String { rawValue }

    var symbol: String {
        switch self {
        case .body: return "car.fill"
        case .wheels: return "circle.circle.fill"
        case .paint: return "paintbrush.fill"
        case .topper: return "sparkles"
        }
    }

    var tint: UIColor {
        switch self {
        case .body: return UIColor(red: 1.00, green: 0.48, blue: 0.13, alpha: 1)
        case .wheels: return UIColor(red: 0.16, green: 0.55, blue: 1.00, alpha: 1)
        case .paint: return UIColor(red: 1.00, green: 0.30, blue: 0.62, alpha: 1)
        case .topper: return UIColor(red: 0.58, green: 0.36, blue: 1.00, alpha: 1)
        }
    }
}

// MARK: - Materials shared by one car

final class CarMaterials {
    let paint = SCNMaterial.pbr(.red, metal: 0.15, rough: 0.32, clearCoat: true)
    let trim = SCNMaterial.pbr(UIColor(white: 0.16, alpha: 1), rough: 0.55)
    let glass: SCNMaterial = {
        let g = SCNMaterial()
        g.lightingModel = .blinn
        g.diffuse.contents = UIColor(red: 0.7, green: 0.9, blue: 1.0, alpha: 0.26)
        g.specular.contents = UIColor(white: 1, alpha: 1)
        g.shininess = 60
        g.transparencyMode = .aOne
        g.blendMode = .alpha
        g.writesToDepthBuffer = false
        return g
    }()
    let chrome = SCNMaterial.pbr(UIColor(white: 0.95, alpha: 1), metal: 1.0, rough: 0.14)
    let rubber = SCNMaterial.pbr(UIColor(white: 0.10, alpha: 1), rough: 0.8)
    let white = SCNMaterial.pbr(UIColor(white: 0.97, alpha: 1), rough: 0.35)
    let gold = SCNMaterial.pbr(UIColor(red: 1.0, green: 0.82, blue: 0.2, alpha: 1), metal: 0.55, rough: 0.25, emission: UIColor(red: 0.35, green: 0.25, blue: 0.0, alpha: 1), clearCoat: true)
    let yellow = SCNMaterial.pbr(UIColor(red: 1.0, green: 0.86, blue: 0.1, alpha: 1), rough: 0.3, clearCoat: true)
    let headlight = SCNMaterial.pbr(UIColor(red: 1.0, green: 0.97, blue: 0.85, alpha: 1), rough: 0.1,
                                     emission: UIColor(red: 1.0, green: 0.95, blue: 0.75, alpha: 1))
    let taillight = SCNMaterial.pbr(UIColor(red: 1.0, green: 0.1, blue: 0.1, alpha: 1), rough: 0.2,
                                     emission: UIColor(red: 0.9, green: 0.05, blue: 0.05, alpha: 1))

    func setPaint(_ p: PaintStyle, animated: Bool) {
        SCNTransaction.begin()
        SCNTransaction.animationDuration = animated ? 0.45 : 0
        paint.diffuse.contents = p.color
        paint.metalness.contents = p.metallic ? 0.85 : 0.15
        paint.roughness.contents = p.metallic ? 0.22 : 0.32
        SCNTransaction.commit()
    }
}

// MARK: - Part definitions

struct BodyStyle: Identifiable {
    let id: String
    /// Wheel radius the body was designed around (body sits on the ground with wheels this size).
    let wheelRadius: Float
    let wheelbase: Float
    let track: Float
    let wheelWidth: Float
    let roof: SCNVector3
    let rear: SCNVector3
    /// Where the driver sits (bottom of the torso) and how big they are.
    let seat: SCNVector3
    let driverScale: Float
    /// Front-of-car spot for things like googly eyes.
    var hood = V(1, 1, 0)
    /// Side panel distance from the centre line, for fender arches. 0 = no arches.
    var sideZ: Float = 0
    let build: (CarMaterials) -> SCNNode
}

struct WheelStyle: Identifiable {
    let id: String
    let scale: Float
    let widthScale: Float
    /// Builds one wheel around the +Y axis (the axle). The hub face points to +Y.
    let build: (CarMaterials, CGFloat, CGFloat) -> SCNNode
}

enum TopperSpot { case roof, rear, hood }

struct TopperStyle: Identifiable {
    let id: String
    let spot: TopperSpot
    let build: ((CarMaterials) -> SCNNode)?
}

struct PaintStyle: Identifiable {
    let id: String
    let color: UIColor
    var metallic = false
}

enum Catalog {
    // MARK: Bodies

    static let bodies: [BodyStyle] = [
        BodyStyle(id: "racer", wheelRadius: 0.42, wheelbase: 2.4, track: 1.75, wheelWidth: 0.36,
                  roof: V(-0.15, 1.15, 0), rear: V(-1.55, 0.70, 0), seat: V(-0.15, 0.25, 0), driverScale: 1.0, hood: V(1.15, 0.72, 0), sideZ: 0.66) { m in
            group("body", [
                boxNode(m.paint, 3.5, 0.40, 1.30, r: 0.18, at: V(0, 0.50, 0)),
                boxNode(m.paint, 1.55, 0.30, 1.72, r: 0.14, at: V(-0.12, 0.46, 0)),
                airfoil(m.paint, chord: 0.55, thickness: 0.09, span: 1.85, at: V(1.88, 0.3, 0)),
                boxNode(m.white, 0.4, 0.14, 0.05, r: 0.02, at: V(1.88, 0.33, 0.94)),
                boxNode(m.white, 0.4, 0.14, 0.05, r: 0.02, at: V(1.88, 0.33, -0.94)),
                sphereNode(m.glass, r: 0.5, at: V(-0.15, 0.7, 0), scale: V(1.6, 0.95, 1.1)),
                sphereNode(m.headlight, r: 0.1, at: V(1.70, 0.56, 0.42)),
                sphereNode(m.headlight, r: 0.1, at: V(1.70, 0.56, -0.42)),
                boxNode(m.taillight, 0.05, 0.1, 0.32, r: 0.02, at: V(-1.76, 0.56, 0.38)),
                boxNode(m.taillight, 0.05, 0.1, 0.32, r: 0.02, at: V(-1.76, 0.56, -0.38)),
                cylNode(m.white, r: 0.24, h: 0.02, axis: .z, at: V(-0.12, 0.47, 0.87)),
                cylNode(m.white, r: 0.24, h: 0.02, axis: .z, at: V(-0.12, 0.47, -0.87)),
                cylNode(m.chrome, r: 0.07, h: 0.3, axis: .x, at: V(-1.82, 0.38, 0.25)),
                cylNode(m.chrome, r: 0.07, h: 0.3, axis: .x, at: V(-1.82, 0.38, -0.25)),
            ])
        },
        BodyStyle(id: "monster", wheelRadius: 0.75, wheelbase: 2.3, track: 2.0, wheelWidth: 0.55,
                  roof: V(-0.25, 2.16, 0), rear: V(-1.45, 1.53, 0), seat: V(-0.1, 1.18, 0), driverScale: 1.0, hood: V(1.05, 1.53, 0), sideZ: 0.765) { m in
            group("body", [
                boxNode(m.trim, 2.8, 0.22, 1.0, r: 0.05, at: V(0, 0.80, 0)),
                cylNode(m.trim, r: 0.08, h: 2.0, axis: .z, at: V(1.15, 0.75, 0)),
                cylNode(m.trim, r: 0.08, h: 2.0, axis: .z, at: V(-1.15, 0.75, 0)),
                cylNode(m.chrome, r: 0.07, h: 0.55, at: V(1.0, 1.0, 0.55)),
                cylNode(m.chrome, r: 0.07, h: 0.55, at: V(1.0, 1.0, -0.55)),
                cylNode(m.chrome, r: 0.07, h: 0.55, at: V(-1.0, 1.0, 0.55)),
                cylNode(m.chrome, r: 0.07, h: 0.55, at: V(-1.0, 1.0, -0.55)),
                boxNode(m.paint, 3.1, 0.55, 1.5, r: 0.16, at: V(0, 1.25, 0)),
                boxNode(m.chrome, 0.05, 0.24, 0.75, r: 0.02, at: V(1.56, 1.2, 0)),
                sphereNode(m.headlight, r: 0.12, at: V(1.52, 1.34, 0.52)),
                sphereNode(m.headlight, r: 0.12, at: V(1.52, 1.34, -0.52)),
                boxNode(m.taillight, 0.05, 0.14, 0.3, r: 0.02, at: V(-1.56, 1.34, 0.5)),
                boxNode(m.taillight, 0.05, 0.14, 0.3, r: 0.02, at: V(-1.56, 1.34, -0.5)),
                boxNode(m.chrome, 0.16, 0.16, 1.62, r: 0.06, at: V(1.62, 0.98, 0)),
                boxNode(m.chrome, 0.16, 0.16, 1.62, r: 0.06, at: V(-1.62, 0.98, 0)),
            ] + cabin(m, x: -0.25, bottom: 1.52, length: 1.45, height: 0.52, width: 1.42))
        },
        BodyStyle(id: "jeep", wheelRadius: 0.5, wheelbase: 2.1, track: 1.75, wheelWidth: 0.42,
                  roof: V(-0.75, 2.1, 0), rear: V(-1.3, 1.26, 0), seat: V(-0.1, 1.12, 0.34), driverScale: 1.1, hood: V(0.85, 1.43, 0), sideZ: 0.735) { m in
            group("body", [
                boxNode(m.paint, 2.7, 0.62, 1.45, r: 0.14, at: V(0, 0.95, 0)),
                boxNode(m.paint, 0.95, 0.2, 1.35, r: 0.08, at: V(0.85, 1.32, 0)),
                boxNode(m.trim, 0.05, 0.42, 0.9, r: 0.02, at: V(1.36, 1.0, 0)),
                sphereNode(m.headlight, r: 0.13, at: V(1.33, 1.1, 0.52)),
                sphereNode(m.headlight, r: 0.13, at: V(1.33, 1.1, -0.52)),
                boxNode(m.trim, 1.15, 0.08, 0.46, r: 0.03, at: V(1.05, 1.08, 0.78)),
                boxNode(m.trim, 1.15, 0.08, 0.46, r: 0.03, at: V(1.05, 1.08, -0.78)),
                boxNode(m.trim, 1.15, 0.08, 0.46, r: 0.03, at: V(-1.05, 1.08, 0.78)),
                boxNode(m.trim, 1.15, 0.08, 0.46, r: 0.03, at: V(-1.05, 1.08, -0.78)),
                boxNode(m.trim, 0.06, 0.52, 1.42, r: 0.03, at: V(0.36, 1.56, 0)),
                boxNode(m.glass, 0.05, 0.40, 1.26, at: V(0.37, 1.56, 0)),
                boxNode(m.trim, 0.42, 0.5, 0.46, r: 0.1, at: V(-0.3, 1.38, 0.34)),
                boxNode(m.trim, 0.42, 0.5, 0.46, r: 0.1, at: V(-0.3, 1.38, -0.34)),
                cylNode(m.chrome, r: 0.05, h: 0.84, at: V(-0.75, 1.68, 0.66)),
                cylNode(m.chrome, r: 0.05, h: 0.84, at: V(-0.75, 1.68, -0.66)),
                cylNode(m.chrome, r: 0.05, h: 1.37, axis: .z, at: V(-0.75, 2.08, 0)),
                torusNode(m.rubber, ring: 0.3, pipe: 0.13, axis: .x, at: V(-1.47, 1.05, 0)),
                cylNode(m.chrome, r: 0.2, h: 0.2, axis: .x, at: V(-1.47, 1.05, 0)),
            ])
        },
        BodyStyle(id: "bus", wheelRadius: 0.46, wheelbase: 3.0, track: 1.65, wheelWidth: 0.38,
                  roof: V(0.3, 2.06, 0), rear: V(-1.85, 2.06, 0), seat: V(1.55, 1.0, 0.4), driverScale: 1.0, hood: V(2.05, 1.42, 0), sideZ: 0.86) { m in
            group("body", [
                boxNode(m.paint, 4.4, 0.85, 1.7, r: 0.2, at: V(0, 1.0, 0)),
                boxNode(m.white, 4.42, 0.12, 1.72, r: 0.04, at: V(0, 1.12, 0)),
                boxNode(m.trim, 0.16, 0.2, 1.62, r: 0.06, at: V(2.22, 0.72, 0)),
                boxNode(m.trim, 0.16, 0.2, 1.62, r: 0.06, at: V(-2.22, 0.72, 0)),
                sphereNode(m.headlight, r: 0.12, at: V(2.17, 0.95, 0.6)),
                sphereNode(m.headlight, r: 0.12, at: V(2.17, 0.95, -0.6)),
                boxNode(m.taillight, 0.05, 0.18, 0.18, r: 0.03, at: V(-2.21, 0.95, 0.6)),
                boxNode(m.taillight, 0.05, 0.18, 0.18, r: 0.03, at: V(-2.21, 0.95, -0.6)),
                boxNode(m.trim, 0.62, 0.8, 0.03, r: 0.02, at: V(1.45, 1.0, 0.85)),
            ] + cabin(m, x: 0, bottom: 1.42, length: 4.4, height: 0.52, width: 1.7, pillars: 4))
        },
        BodyStyle(id: "bubble", wheelRadius: 0.42, wheelbase: 1.9, track: 1.6, wheelWidth: 0.36,
                  roof: V(-0.05, 1.82, 0), rear: V(-1.3, 1.15, 0), seat: V(0.0, 0.95, 0), driverScale: 1.05, hood: V(0.9, 1.3, 0), sideZ: 0) { m in
            group("body", [
                sphereNode(m.paint, r: 1, at: V(0, 0.85, 0), scale: V(1.55, 0.64, 0.84)),
                sphereNode(m.glass, r: 1, at: V(-0.05, 1.24, 0), scale: V(1.0, 0.64, 0.76)),
                sphereNode(m.headlight, r: 0.15, at: V(1.28, 0.98, 0.45)),
                sphereNode(m.headlight, r: 0.15, at: V(1.28, 0.98, -0.45)),
                capsuleNode(m.chrome, r: 0.08, h: 1.1, axis: .z, at: V(1.45, 0.55, 0)),
                capsuleNode(m.chrome, r: 0.08, h: 1.1, axis: .z, at: V(-1.45, 0.55, 0)),
                sphereNode(m.paint, r: 0.42, at: V(0.95, 0.72, 0.62), scale: V(1.3, 0.8, 0.7)),
                sphereNode(m.paint, r: 0.42, at: V(0.95, 0.72, -0.62), scale: V(1.3, 0.8, 0.7)),
                sphereNode(m.paint, r: 0.42, at: V(-0.95, 0.72, 0.62), scale: V(1.3, 0.8, 0.7)),
                sphereNode(m.paint, r: 0.42, at: V(-0.95, 0.72, -0.62), scale: V(1.3, 0.8, 0.7)),
                capsuleNode(m.chrome, r: 0.03, h: 0.2, axis: .x, at: V(0.25, 1.05, 0.83)),
                capsuleNode(m.chrome, r: 0.03, h: 0.2, axis: .x, at: V(0.25, 1.05, -0.83)),
                sphereNode(m.taillight, r: 0.09, at: V(-1.44, 0.92, 0.42)),
                sphereNode(m.taillight, r: 0.09, at: V(-1.44, 0.92, -0.42)),
            ])
        },
        BodyStyle(id: "pickup", wheelRadius: 0.48, wheelbase: 2.6, track: 1.75, wheelWidth: 0.4,
                  roof: V(0.25, 1.88, 0), rear: V(-1.8, 1.5, 0), seat: V(0.3, 0.88, 0), driverScale: 1.05, hood: V(1.35, 1.2, 0), sideZ: 0.81) { m in
            group("body", [
                boxNode(m.paint, 3.9, 0.6, 1.6, r: 0.16, at: V(0, 0.9, 0)),
                boxNode(m.trim, 1.6, 0.06, 1.42, at: V(-1.05, 1.21, 0)),
                boxNode(m.paint, 1.7, 0.32, 0.1, r: 0.04, at: V(-1.05, 1.36, 0.75)),
                boxNode(m.paint, 1.7, 0.32, 0.1, r: 0.04, at: V(-1.05, 1.36, -0.75)),
                boxNode(m.paint, 0.1, 0.32, 1.6, r: 0.04, at: V(-1.9, 1.36, 0)),
                boxNode(m.chrome, 0.05, 0.3, 1.0, r: 0.02, at: V(1.96, 0.95, 0)),
                sphereNode(m.headlight, r: 0.11, at: V(1.93, 1.03, 0.62)),
                sphereNode(m.headlight, r: 0.11, at: V(1.93, 1.03, -0.62)),
                boxNode(m.chrome, 0.15, 0.16, 1.7, r: 0.06, at: V(2.0, 0.7, 0)),
                boxNode(m.chrome, 0.15, 0.16, 1.7, r: 0.06, at: V(-2.0, 0.7, 0)),
                boxNode(m.taillight, 0.05, 0.16, 0.2, r: 0.03, at: V(-1.96, 1.0, 0.62)),
                boxNode(m.taillight, 0.05, 0.16, 0.2, r: 0.03, at: V(-1.96, 1.0, -0.62)),
            ] + cabin(m, x: 0.25, bottom: 1.2, length: 1.25, height: 0.55, width: 1.5))
        },
    ]

    // MARK: Wheels (built around +Y, hub face toward +Y)

    static let wheels: [WheelStyle] = [
        WheelStyle(id: "classic", scale: 1.0, widthScale: 1.0) { m, r, w in
            let tire = torusNode(m.rubber, ring: r * 0.7, pipe: r * 0.3, at: V(0, 0, 0))
            tire.scale = V(1, Float(w / (r * 0.6)), 1)
            return group(nil, [
                tire,
                cylNode(m.chrome, r: r * 0.52, h: w * 0.8, at: V(0, 0, 0)),
                cylNode(m.paint, r: r * 0.22, h: w * 0.92, at: V(0, 0, 0)),
            ])
        },
        WheelStyle(id: "monster", scale: 1.3, widthScale: 1.5) { m, r, w in
            let tire = torusNode(m.rubber, ring: r * 0.66, pipe: r * 0.34, at: V(0, 0, 0))
            tire.scale = V(1, Float(w / (r * 0.68)), 1)
            var parts = [tire,
                         cylNode(m.yellow, r: r * 0.45, h: w * 0.78, at: V(0, 0, 0)),
                         cylNode(m.chrome, r: r * 0.16, h: w * 0.9, at: V(0, 0, 0))]
            let knobs = 14
            for i in 0..<knobs {
                let a = Float(i) / Float(knobs) * 2 * .pi
                let k = boxNode(m.rubber, r * 0.22, w * 0.86, r * 0.16, r: r * 0.04,
                                at: V(cos(a) * Float(r) * 0.97, 0, sin(a) * Float(r) * 0.97))
                k.eulerAngles.y = -a
                parts.append(k)
            }
            return group(nil, parts)
        },
        WheelStyle(id: "racing", scale: 0.95, widthScale: 1.35) { m, r, w in
            var parts = [cylNode(m.rubber, r: r, h: w, at: V(0, 0, 0)),
                         cylNode(m.yellow, r: r * 0.68, h: w * 1.02, at: V(0, 0, 0)),
                         cylNode(m.trim, r: r * 0.2, h: w * 1.06, at: V(0, 0, 0))]
            for i in 0..<6 {
                let a = Float(i) / 6 * 2 * .pi
                let s = boxNode(m.trim, r * 0.5, w * 1.04, r * 0.09,
                                at: V(cos(a) * Float(r) * 0.36, 0, sin(a) * Float(r) * 0.36))
                s.eulerAngles.y = -a
                parts.append(s)
            }
            return group(nil, parts)
        },
        WheelStyle(id: "star", scale: 1.05, widthScale: 1.0) { m, r, w in
            let tire = torusNode(m.rubber, ring: r * 0.7, pipe: r * 0.3, at: V(0, 0, 0))
            tire.scale = V(1, Float(w / (r * 0.6)), 1)
            let star = UIBezierPath()
            for k in 0..<10 {
                let ang = CGFloat(k) / 10 * 2 * .pi + .pi / 2
                let rad = (k % 2 == 0 ? 0.46 : 0.2) * r
                let pt = CGPoint(x: cos(ang) * rad, y: sin(ang) * rad)
                if k == 0 { star.move(to: pt) } else { star.addLine(to: pt) }
            }
            star.close()
            star.flatness = 0.004
            let shape = SCNShape(path: star, extrusionDepth: w * 0.2)
            shape.chamferRadius = 0.01
            shape.materials = [m.gold]
            let starNode = SCNNode(geometry: shape)
            starNode.eulerAngles.x = -.pi / 2       // face toward +Y (the hub side)
            starNode.position = V(0, Float(w) * 0.42, 0)
            return group(nil, [tire,
                               cylNode(m.white, r: r * 0.52, h: w * 0.8, at: V(0, 0, 0)),
                               starNode])
        },
        WheelStyle(id: "donut", scale: 1.05, widthScale: 1.25) { m, r, w in
            let dough = SCNMaterial.pbr(UIColor(red: 0.85, green: 0.6, blue: 0.32, alpha: 1), rough: 0.7)
            let frosting = SCNMaterial.pbr(UIColor(red: 1.0, green: 0.55, blue: 0.75, alpha: 1), rough: 0.25, clearCoat: true)
            let ringR = r * 0.64, pipe = r * 0.36
            let base = torusNode(dough, ring: ringR, pipe: pipe, at: V(0, 0, 0))
            base.scale = V(1, Float(w / (pipe * 2)), 1)
            let icing = torusNode(frosting, ring: ringR, pipe: pipe * 1.02, at: V(0, Float(w) * 0.12, 0))
            icing.scale = V(1, Float(w / (pipe * 2)) * 0.8, 1)
            var parts = [base, icing]
            let sprinkleColors: [UIColor] = [.systemYellow, .systemTeal, .white, .systemGreen, .systemPurple, .systemOrange]
            for i in 0..<16 {
                let a = Float(i) / 16 * 2 * .pi + Float(i % 3) * 0.2
                let rr = Float(ringR) + (i % 2 == 0 ? 0.08 : -0.08) * Float(r)
                let mat = SCNMaterial.pbr(sprinkleColors[i % sprinkleColors.count], rough: 0.3)
                let s = SCNNode(geometry: SCNCapsule(capRadius: r * 0.035, height: r * 0.16))
                s.geometry?.materials = [mat]
                s.position = V(cos(a) * rr, Float(w) * 0.5 + Float(pipe) * 0.05, sin(a) * rr)
                s.eulerAngles = V(.pi / 2, Float(i) * 1.3, 0)
                parts.append(s)
            }
            return group(nil, parts)
        },
        WheelStyle(id: "neon", scale: 1.0, widthScale: 1.1) { m, r, w in
            let glow = SCNMaterial.pbr(UIColor(red: 0.2, green: 1.0, blue: 0.95, alpha: 1), rough: 0.2,
                                       emission: UIColor(red: 0.1, green: 0.95, blue: 1.0, alpha: 1))
            let tire = torusNode(m.rubber, ring: r * 0.7, pipe: r * 0.3, at: V(0, 0, 0))
            tire.scale = V(1, Float(w / (r * 0.6)), 1)
            return group(nil, [
                tire,
                cylNode(m.trim, r: r * 0.5, h: w * 0.8, at: V(0, 0, 0)),
                torusNode(glow, ring: r * 0.44, pipe: r * 0.05, at: V(0, Float(w) * 0.42, 0)),
                torusNode(glow, ring: r * 0.44, pipe: r * 0.05, at: V(0, -Float(w) * 0.42, 0)),
                cylNode(glow, r: r * 0.14, h: w * 0.9, at: V(0, 0, 0)),
            ])
        },
    ]

    // MARK: Toppers

    static let toppers: [TopperStyle] = [
        TopperStyle(id: "none", spot: .roof, build: nil),
        TopperStyle(id: "spoiler", spot: .rear) { m in
            group("topper", [
                boxNode(m.trim, 0.1, 0.34, 0.08, r: 0.03, at: V(0, 0.15, 0.45)),
                boxNode(m.trim, 0.1, 0.34, 0.08, r: 0.03, at: V(0, 0.15, -0.45)),
                airfoil(m.paint, chord: 0.6, thickness: 0.11, span: 1.6, at: V(-0.05, 0.36, 0)),
                boxNode(m.white, 0.62, 0.26, 0.06, r: 0.03, at: V(-0.05, 0.37, 0.8)),
                boxNode(m.white, 0.62, 0.26, 0.06, r: 0.03, at: V(-0.05, 0.37, -0.8)),
            ])
        },
        TopperStyle(id: "siren", spot: .roof) { m in
            let red = SCNMaterial.pbr(UIColor(red: 1, green: 0.15, blue: 0.15, alpha: 1), rough: 0.2, emission: .red)
            let blue = SCNMaterial.pbr(UIColor(red: 0.2, green: 0.4, blue: 1, alpha: 1), rough: 0.2, emission: UIColor(red: 0.1, green: 0.3, blue: 1, alpha: 1))
            let node = group("topper", [
                boxNode(m.trim, 0.36, 0.08, 1.0, r: 0.03, at: V(0, 0.04, 0)),
                boxNode(red, 0.32, 0.2, 0.42, r: 0.08, at: V(0, 0.18, 0.24)),
                boxNode(blue, 0.32, 0.2, 0.42, r: 0.08, at: V(0, 0.18, -0.24)),
            ])
            let flip = SCNAction.sequence([
                .run { _ in red.emission.intensity = 1.6; blue.emission.intensity = 0.05 },
                .wait(duration: 0.28),
                .run { _ in red.emission.intensity = 0.05; blue.emission.intensity = 1.6 },
                .wait(duration: 0.28),
            ])
            node.runAction(.repeatForever(flip))
            return node
        },
        TopperStyle(id: "rockets", spot: .rear) { m in
            let flame = SCNMaterial.pbr(.orange, rough: 0.4, emission: UIColor(red: 1, green: 0.55, blue: 0.05, alpha: 1))
            var parts: [SCNNode] = []
            for side: Float in [1, -1] {
                parts.append(cylNode(m.chrome, r: 0.15, h: 0.8, axis: .x, at: V(0.05, 0.2, side * 0.42)))
                parts.append(coneNode(m.taillight, top: 0, bottom: 0.15, h: 0.32, axis: .x, at: V(0.61, 0.2, side * 0.42)))
                parts.append(cylNode(m.trim, r: 0.12, h: 0.1, axis: .x, at: V(-0.38, 0.2, side * 0.42)))
                let f = coneNode(flame, top: 0, bottom: 0.11, h: 0.4, axis: .negX, at: V(-0.62, 0.2, side * 0.42))
                f.name = "flame"
                f.runAction(.repeatForever(.sequence([
                    .scale(to: 1.25, duration: 0.09), .scale(to: 0.85, duration: 0.09),
                ])))
                parts.append(f)
            }
            return group("topper", parts)
        },
        TopperStyle(id: "fin", spot: .roof) { m in
            let path = UIBezierPath()
            path.move(to: CGPoint(x: 0.45, y: 0))
            path.addLine(to: CGPoint(x: -0.4, y: 0))
            path.addQuadCurve(to: CGPoint(x: -0.45, y: 0.75), controlPoint: CGPoint(x: -0.15, y: 0.3))
            path.addQuadCurve(to: CGPoint(x: 0.45, y: 0), controlPoint: CGPoint(x: 0.0, y: 0.45))
            path.flatness = 0.004
            let shape = SCNShape(path: path, extrusionDepth: 0.12)
            shape.chamferRadius = 0.04
            shape.materials = [m.paint]
            let fin = SCNNode(geometry: shape)
            return group("topper", [fin])
        },
        TopperStyle(id: "crown", spot: .roof) { m in
            let band = SCNNode(geometry: SCNTube(innerRadius: 0.36, outerRadius: 0.42, height: 0.26))
            band.geometry?.materials = [m.gold]
            band.position = V(0, 0.13, 0)
            var parts = [band]
            for i in 0..<6 {
                let a = Float(i) / 6 * 2 * .pi
                parts.append(coneNode(m.gold, top: 0, bottom: 0.08, h: 0.22, at: V(cos(a) * 0.39, 0.36, sin(a) * 0.39)))
                parts.append(sphereNode(m.gold, r: 0.045, at: V(cos(a) * 0.39, 0.48, sin(a) * 0.39)))
            }
            let gem = SCNMaterial.pbr(UIColor(red: 0.9, green: 0.1, blue: 0.3, alpha: 1), metal: 0.3, rough: 0.05, clearCoat: true)
            parts.append(sphereNode(gem, r: 0.08, at: V(0.42, 0.13, 0)))
            return group("topper", parts)
        },
        TopperStyle(id: "eyes", spot: .hood) { m in
            var parts: [SCNNode] = []
            for side: Float in [1, -1] {
                let eye = sphereNode(m.white, r: 0.26, at: V(0.0, 0.16, side * 0.3), scale: V(0.8, 1, 1))
                let pupilPivot = SCNNode()
                pupilPivot.position = eye.position
                let pupil = sphereNode(m.rubber, r: 0.11, at: V(0.17, 0.02, 0))
                pupilPivot.addChildNode(pupil)
                pupilPivot.runAction(.repeatForever(.sequence([
                    .wait(duration: 1.4),
                    .rotateTo(x: 0, y: 0.5, z: 0, duration: 0.15),
                    .wait(duration: 0.9),
                    .rotateTo(x: 0, y: -0.5, z: 0, duration: 0.15),
                    .wait(duration: 0.9),
                    .rotateTo(x: 0, y: 0, z: 0, duration: 0.15),
                ])))
                parts.append(eye)
                parts.append(pupilPivot)
            }
            return group("topper", parts)
        },
    ]

    // MARK: Paint

    static let paints: [PaintStyle] = [
        PaintStyle(id: "red", color: UIColor(red: 0.92, green: 0.10, blue: 0.10, alpha: 1)),
        PaintStyle(id: "orange", color: UIColor(red: 1.00, green: 0.48, blue: 0.05, alpha: 1)),
        PaintStyle(id: "yellow", color: UIColor(red: 1.00, green: 0.85, blue: 0.05, alpha: 1)),
        PaintStyle(id: "green", color: UIColor(red: 0.18, green: 0.78, blue: 0.22, alpha: 1)),
        PaintStyle(id: "teal", color: UIColor(red: 0.05, green: 0.78, blue: 0.85, alpha: 1)),
        PaintStyle(id: "blue", color: UIColor(red: 0.10, green: 0.35, blue: 0.95, alpha: 1)),
        PaintStyle(id: "purple", color: UIColor(red: 0.55, green: 0.22, blue: 0.90, alpha: 1)),
        PaintStyle(id: "pink", color: UIColor(red: 1.00, green: 0.40, blue: 0.70, alpha: 1)),
        PaintStyle(id: "white", color: UIColor(white: 0.96, alpha: 1)),
        PaintStyle(id: "black", color: UIColor(white: 0.08, alpha: 1)),
        PaintStyle(id: "gold", color: UIColor(red: 1.0, green: 0.75, blue: 0.25, alpha: 1), metallic: true),
        PaintStyle(id: "silver", color: UIColor(white: 0.85, alpha: 1), metallic: true),
    ]

    /// A wing with a rounded, teardrop profile (front toward +X), spanning Z.
    static func airfoil(_ mat: SCNMaterial, chord: CGFloat, thickness: CGFloat, span: CGFloat, at p: SCNVector3) -> SCNNode {
        let path = UIBezierPath()
        path.move(to: CGPoint(x: chord / 2, y: 0))
        path.addQuadCurve(to: CGPoint(x: -chord / 2, y: thickness * 0.15), controlPoint: CGPoint(x: chord * 0.2, y: thickness * 1.2))
        path.addQuadCurve(to: CGPoint(x: chord / 2, y: 0), controlPoint: CGPoint(x: 0, y: -thickness * 0.4))
        path.close()
        path.flatness = 0.004
        let shape = SCNShape(path: path, extrusionDepth: span)
        shape.chamferRadius = 0.015
        shape.materials = [mat]
        let n = SCNNode(geometry: shape)
        n.position = p
        return n
    }

    /// A see-through cab: corner pillars, a roof, and a glass box so the driver shows.
    static func cabin(_ m: CarMaterials, x: Float, bottom: Float, length: CGFloat, height: CGFloat, width: CGFloat, pillars: Int = 2) -> [SCNNode] {
        let l = Float(length), h = Float(height), w = Float(width)
        let p: CGFloat = 0.12
        let inset = Float(p) / 2
        var parts: [SCNNode] = []
        for i in 0..<pillars {
            let px = x - l / 2 + inset + (l - 2 * inset) * Float(i) / Float(pillars - 1)
            for side: Float in [1, -1] {
                parts.append(boxNode(m.paint, p, height, p, r: 0.04, at: V(px, bottom + h / 2, side * (w / 2 - inset))))
            }
        }
        parts.append(boxNode(m.paint, length + 0.06, 0.13, width + 0.06, r: 0.06, at: V(x, bottom + h + 0.05, 0)))
        parts.append(boxNode(m.glass, length - 0.05, height, width - 0.05, r: 0.03, at: V(x, bottom + h / 2, 0)))
        return parts
    }

    static func body(_ id: String) -> BodyStyle { bodies.first { $0.id == id } ?? bodies[0] }
    static func wheel(_ id: String) -> WheelStyle { wheels.first { $0.id == id } ?? wheels[0] }
    static func topper(_ id: String) -> TopperStyle { toppers.first { $0.id == id } ?? toppers[0] }
    static func paint(_ id: String) -> PaintStyle { paints.first { $0.id == id } ?? paints[0] }
}
