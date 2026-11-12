import SceneKit
import UIKit

/// Small touches that make each body read as a real, desirable vehicle:
/// chrome headlight rims, grilles, mirrors and racing numbers.
enum Details {
    static func decorate(_ bodyID: String, _ node: SCNNode, _ m: CarMaterials) {
        var parts: [SCNNode] = []
        func lamps(x: Float, y: Float, z: Float, r: CGFloat) {
            for s: Float in [1, -1] {
                parts.append(torusNode(m.chrome, ring: r, pipe: r * 0.22, axis: .x, at: V(x, y, s * z)))
            }
        }
        func slats(x: Float, ys: [Float], width: CGFloat) {
            for y in ys { parts.append(boxNode(m.trim, 0.06, 0.035, width, r: 0.015, at: V(x, y, 0))) }
        }
        func mirrors(x: Float, y: Float, z: Float) {
            for s: Float in [1, -1] {
                parts.append(boxNode(m.trim, 0.06, 0.04, 0.16, at: V(x, y, s * (z - 0.06))))
                parts.append(boxNode(m.paint, 0.08, 0.16, 0.12, r: 0.04, at: V(x, y + 0.02, s * (z + 0.04))))
                parts.append(boxNode(m.chrome, 0.02, 0.12, 0.09, r: 0.02, at: V(x - 0.05, y + 0.02, s * (z + 0.04))))
            }
        }
        func number(_ text: String, x: Float, y: Float, z: Float, r: CGFloat, disc: Bool = true) {
            for s: Float in [1, -1] {
                if disc { parts.append(cylNode(m.white, r: r, h: 0.02, axis: .z, at: V(x, y, s * z))) }
                parts.append(numeral(text, height: r * 1.3, at: V(x, y, s * (z + 0.012)), facingPlusZ: s > 0, m: m))
            }
        }

        switch bodyID {
        case "racer":
            lamps(x: 1.74, y: 0.56, z: 0.42, r: 0.1)
            parts.append(boxNode(m.trim, 0.04, 0.12, 0.7, r: 0.03, at: V(1.76, 0.44, 0)))
            number("1", x: -0.12, y: 0.47, z: 0.875, r: 0.24, disc: false)
        case "monster":
            lamps(x: 1.58, y: 1.34, z: 0.52, r: 0.12)
            slats(x: 1.59, ys: [1.12, 1.2, 1.28], width: 0.7)
            mirrors(x: 0.42, y: 1.86, z: 0.78)
            number("5", x: 0.35, y: 1.25, z: 0.76, r: 0.22)
        case "jeep":
            lamps(x: 1.4, y: 1.1, z: 0.52, r: 0.13)
            for i in -2...2 {
                parts.append(boxNode(m.chrome, 0.04, 0.34, 0.06, r: 0.02, at: V(1.39, 0.98, Float(i) * 0.14)))
            }
            mirrors(x: 0.4, y: 1.55, z: 0.78)
            number("2", x: 0.1, y: 0.95, z: 0.735, r: 0.22)
        case "bus":
            lamps(x: 2.22, y: 0.95, z: 0.6, r: 0.12)
            slats(x: 2.22, ys: [0.68, 0.76], width: 1.0)
            mirrors(x: 2.25, y: 1.6, z: 0.92)
            number("3", x: -0.6, y: 1.0, z: 0.86, r: 0.24)
        case "bubble":
            lamps(x: 1.37, y: 0.98, z: 0.45, r: 0.14)
            number("8", x: -0.05, y: 0.82, z: 0.83, r: 0.22)
        case "pickup":
            lamps(x: 1.99, y: 1.03, z: 0.62, r: 0.11)
            slats(x: 1.99, ys: [0.86, 0.95, 1.04], width: 0.9)
            mirrors(x: 0.86, y: 1.5, z: 0.8)
            number("4", x: 0.25, y: 0.92, z: 0.81, r: 0.22)
        default: break
        }
        parts.forEach { node.addChildNode($0) }
    }

    private static func numeral(_ s: String, height: CGFloat, at p: SCNVector3, facingPlusZ: Bool, m: CarMaterials) -> SCNNode {
        let text = SCNText(string: s, extrusionDepth: 0.5)
        text.font = UIFont.systemFont(ofSize: 10, weight: .black)
        text.flatness = 0.05
        text.materials = [m.trim]
        let glyph = SCNNode(geometry: text)
        let (lo, hi) = text.boundingBox
        glyph.position = V(-(lo.x + hi.x) / 2, -(lo.y + hi.y) / 2, 0)
        let n = SCNNode()
        n.addChildNode(glyph)
        let k = Float(height) / max(hi.y - lo.y, 0.001)
        n.scale = V(k, k, k * 0.1)
        n.position = p
        if !facingPlusZ { n.eulerAngles.y = .pi }
        return n
    }
}
