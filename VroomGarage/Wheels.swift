import SceneKit
import UIKit

/// Pieces for realistic wheels. Every wheel is built around +Y (the axle) with the hub face toward +Y.
enum WheelKit {
    /// A tyre with rounded sidewalls and a treaded face.
    static func tyre(_ m: CarMaterials, r: CGFloat, w: CGFloat, rim: CGFloat, knobby: Bool = false, whitewall: Bool = false) -> [SCNNode] {
        let pipe = (r * 0.985 - rim) / 2
        let ring = rim + pipe
        let side = torusNode(m.rubber, ring: ring, pipe: pipe, at: V(0, 0, 0))
        side.scale = V(1, Float(w / 2 / pipe), 1)
        var out = [side, cylNode(m.tread, r: r, h: w * 0.8, at: V(0, 0, 0))]
        if whitewall {
            let band = SCNNode(geometry: SCNTube(innerRadius: ring - pipe * 0.55, outerRadius: ring + pipe * 0.35, height: 0.012))
            band.geometry?.materials = [m.white]
            band.position = V(0, Float(w) * 0.49, 0)
            out.append(band)
        }
        if knobby {
            let knobs = 18
            for i in 0..<knobs {
                let a = Float(i) / Float(knobs) * 2 * .pi
                for (k, y) in [Float(-0.25), 0.25].enumerated() {
                    let k2 = boxNode(m.rubber, r * 0.16, w * 0.42, r * 0.12, r: r * 0.03,
                                     at: V(Float(r) * 1.0, y * Float(w) + (k == 0 ? 0 : 0), 0))
                    let arm = SCNNode()
                    arm.eulerAngles.y = -a - (k == 0 ? 0 : .pi / Float(knobs))
                    arm.addChildNode(k2)
                    out.append(arm)
                }
            }
        }
        return out
    }

    /// The rim's barrel, a dark back face (for depth) and the outer lip.
    static func barrel(_ m: CarMaterials, rim: CGFloat, w: CGFloat, lip: SCNMaterial, back: SCNMaterial? = nil) -> [SCNNode] {
        let tube = SCNNode(geometry: SCNTube(innerRadius: rim * 0.9, outerRadius: rim, height: w * 0.84))
        tube.geometry?.materials = [m.gunmetal]
        return [tube,
                cylNode(back ?? m.grille, r: rim * 0.9, h: 0.02, at: V(0, Float(w) * 0.02, 0)),
                torusNode(lip, ring: rim * 0.95, pipe: rim * 0.06, at: V(0, Float(w) * 0.4, 0))]
    }

    /// Radial spokes on the hub face.
    static func spokes(_ mat: SCNMaterial, count: Int, from inner: CGFloat, to outer: CGFloat, y: CGFloat,
                       width: CGFloat, depth: CGFloat, twin: Bool = false, twist: Float = 0) -> [SCNNode] {
        var out: [SCNNode] = []
        let len = outer - inner
        for i in 0..<count {
            let a = Float(i) / Float(count) * 2 * .pi
            for off: Float in twin ? [-0.09, 0.09] : [0] {
                let s = boxNode(mat, len, depth, width, r: min(width, depth) * 0.4, at: V(Float(inner + len / 2), Float(y), 0))
                s.eulerAngles.y = twist
                let arm = SCNNode()
                arm.eulerAngles.y = -(a + off)
                arm.addChildNode(s)
                out.append(arm)
            }
        }
        return out
    }

    /// Centre cap and lug nuts.
    static func hub(_ m: CarMaterials, rim: CGFloat, w: CGFloat, cap: SCNMaterial, lugs: Int = 5) -> [SCNNode] {
        var out = [cylNode(cap, r: rim * 0.2, h: w * 0.12, at: V(0, Float(w) * 0.4, 0))]
        for i in 0..<lugs {
            let a = Float(i) / Float(lugs) * 2 * .pi
            out.append(cylNode(m.chrome, r: rim * 0.035, h: w * 0.1, at: V(cos(a) * Float(rim) * 0.3, Float(w) * 0.4, sin(a) * Float(rim) * 0.3)))
        }
        return out
    }
}

extension Catalog {
    static let wheels: [WheelStyle] = [
        WheelStyle(id: "alloy", scale: 1.0, widthScale: 1.0) { m, r, w in
            let rim = r * 0.64
            return group(nil, WheelKit.tyre(m, r: r, w: w, rim: rim)
                + WheelKit.barrel(m, rim: rim, w: w, lip: m.alloy)
                + WheelKit.spokes(m.alloy, count: 5, from: rim * 0.2, to: rim * 0.95, y: w * 0.34, width: rim * 0.09, depth: w * 0.1, twin: true)
                + WheelKit.hub(m, rim: rim, w: w, cap: m.alloy))
        },
        WheelStyle(id: "chrome", scale: 1.0, widthScale: 1.05) { m, r, w in
            let rim = r * 0.62
            return group(nil, WheelKit.tyre(m, r: r, w: w, rim: rim)
                + WheelKit.barrel(m, rim: rim, w: w, lip: m.chrome, back: m.chrome)
                + WheelKit.spokes(m.chrome, count: 5, from: rim * 0.2, to: rim * 0.72, y: w * 0.22, width: rim * 0.2, depth: w * 0.1)
                + [torusNode(m.chrome, ring: rim * 0.82, pipe: rim * 0.12, at: V(0, Float(w) * 0.3, 0))]
                + WheelKit.hub(m, rim: rim, w: w, cap: m.chrome))
        },
        WheelStyle(id: "mesh", scale: 1.0, widthScale: 1.05) { m, r, w in
            let rim = r * 0.66
            return group(nil, WheelKit.tyre(m, r: r, w: w, rim: rim)
                + WheelKit.barrel(m, rim: rim, w: w, lip: m.chrome)
                + WheelKit.spokes(m.gunmetal, count: 10, from: rim * 0.18, to: rim * 0.92, y: w * 0.33, width: rim * 0.05, depth: w * 0.08)
                + WheelKit.spokes(m.gunmetal, count: 10, from: rim * 0.45, to: rim * 0.92, y: w * 0.33, width: rim * 0.05, depth: w * 0.08, twist: 0)
                    .map { $0.eulerAngles.y += .pi / 10; return $0 }
                + WheelKit.hub(m, rim: rim, w: w, cap: m.gunmetal))
        },
        WheelStyle(id: "racing", scale: 0.98, widthScale: 1.25) { m, r, w in
            let rim = r * 0.72
            let nut = SCNMaterial.pbr(UIColor(red: 0.9, green: 0.1, blue: 0.1, alpha: 1), metal: 0.6, rough: 0.3)
            return group(nil, WheelKit.tyre(m, r: r, w: w, rim: rim)
                + WheelKit.barrel(m, rim: rim, w: w, lip: m.gold)
                + WheelKit.spokes(m.gold, count: 6, from: rim * 0.15, to: rim * 0.95, y: w * 0.32, width: rim * 0.13, depth: w * 0.1)
                + [cylNode(nut, r: rim * 0.17, h: w * 0.16, at: V(0, Float(w) * 0.4, 0)),
                   cylNode(m.gold, r: rim * 0.22, h: w * 0.1, at: V(0, Float(w) * 0.36, 0))])
        },
        WheelStyle(id: "offroad", scale: 1.22, widthScale: 1.35) { m, r, w in
            let rim = r * 0.52
            var parts = WheelKit.tyre(m, r: r * 0.92, w: w, rim: rim, knobby: true)
                + WheelKit.barrel(m, rim: rim, w: w, lip: m.gunmetal, back: m.trim)
                + WheelKit.spokes(m.trim, count: 8, from: rim * 0.2, to: rim * 0.9, y: w * 0.3, width: rim * 0.14, depth: w * 0.08)
            // beadlock ring with bolts
            let ring = SCNNode(geometry: SCNTube(innerRadius: rim * 0.82, outerRadius: rim * 1.06, height: w * 0.06))
            ring.geometry?.materials = [m.gunmetal]
            ring.position = V(0, Float(w) * 0.42, 0)
            parts.append(ring)
            for i in 0..<14 {
                let a = Float(i) / 14 * 2 * .pi
                parts.append(cylNode(m.chrome, r: rim * 0.035, h: w * 0.08, at: V(cos(a) * Float(rim) * 0.94, Float(w) * 0.45, sin(a) * Float(rim) * 0.94)))
            }
            parts += WheelKit.hub(m, rim: rim, w: w, cap: m.chrome, lugs: 6)
            return group(nil, parts)
        },
        WheelStyle(id: "whitewall", scale: 1.02, widthScale: 0.95) { m, r, w in
            let rim = r * 0.58
            return group(nil, WheelKit.tyre(m, r: r, w: w, rim: rim, whitewall: true)
                + WheelKit.barrel(m, rim: rim, w: w, lip: m.chrome, back: m.paint)
                + [cylNode(m.paint, r: rim * 0.92, h: w * 0.04, at: V(0, Float(w) * 0.3, 0)),
                   sphereNode(m.chrome, r: rim * 0.62, at: V(0, Float(w) * 0.3, 0), scale: V(1, 0.3, 1))])
        },
        WheelStyle(id: "wire", scale: 1.02, widthScale: 0.9) { m, r, w in
            let rim = r * 0.64
            var parts = WheelKit.tyre(m, r: r, w: w, rim: rim, whitewall: true)
                + WheelKit.barrel(m, rim: rim, w: w, lip: m.chrome, back: m.trim)
                + [cylNode(m.chrome, r: rim * 0.2, h: w * 0.6, at: V(0, Float(w) * 0.1, 0)),
                   cylNode(m.gold, r: rim * 0.12, h: w * 0.7, at: V(0, Float(w) * 0.1, 0))]
            let count = 24
            for i in 0..<count {
                let a = Float(i) / Float(count) * 2 * .pi
                let lace: Float = i % 2 == 0 ? 0.25 : -0.1
                let spoke = cylNode(m.chrome, r: rim * 0.018, h: rim * 0.78, axis: .x, at: V(Float(rim) * 0.56, Float(w) * lace, 0))
                spoke.eulerAngles.y = 0.25
                let arm = SCNNode()
                arm.eulerAngles.y = -a
                arm.addChildNode(spoke)
                parts.append(arm)
            }
            return group(nil, parts)
        },
        WheelStyle(id: "glow", scale: 1.0, widthScale: 1.1) { m, r, w in
            let rim = r * 0.66
            let glow = SCNMaterial.pbr(UIColor(red: 0.2, green: 1.0, blue: 0.95, alpha: 1), rough: 0.2,
                                       emission: UIColor(red: 0.1, green: 0.95, blue: 1.0, alpha: 1))
            return group(nil, WheelKit.tyre(m, r: r, w: w, rim: rim)
                + WheelKit.barrel(m, rim: rim, w: w, lip: glow, back: m.trim)
                + WheelKit.spokes(m.trim, count: 7, from: rim * 0.18, to: rim * 0.92, y: w * 0.33, width: rim * 0.1, depth: w * 0.1)
                + WheelKit.hub(m, rim: rim, w: w, cap: glow))
        },
    ]
}
