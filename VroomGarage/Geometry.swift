import SceneKit
import UIKit

// Small helpers so part definitions read like a recipe.
// Car space: +X is the front of the car, +Y is up, Z is the car's width. Ground is y = 0.

@inline(__always) func V(_ x: Float, _ y: Float, _ z: Float) -> SCNVector3 { SCNVector3(x, y, z) }

enum Axis { case x, y, z, negX }

func orient(_ node: SCNNode, _ axis: Axis) {
    // SceneKit cylinders/cones/tori are built around +Y. Rotate so +Y points along `axis`.
    switch axis {
    case .y: break
    case .x: node.eulerAngles.z = -.pi / 2
    case .negX: node.eulerAngles.z = .pi / 2
    case .z: node.eulerAngles.x = .pi / 2
    }
}

func boxNode(_ m: SCNMaterial, _ sx: CGFloat, _ sy: CGFloat, _ sz: CGFloat, r: CGFloat = 0, at p: SCNVector3) -> SCNNode {
    let g = SCNBox(width: sx, height: sy, length: sz, chamferRadius: min(r, min(sx, min(sy, sz)) / 2))
    g.chamferSegmentCount = 6
    g.materials = [m]
    let n = SCNNode(geometry: g)
    n.position = p
    return n
}

func sphereNode(_ m: SCNMaterial, r: CGFloat, at p: SCNVector3, scale: SCNVector3 = V(1, 1, 1)) -> SCNNode {
    let g = SCNSphere(radius: r)
    g.segmentCount = 40
    g.materials = [m]
    let n = SCNNode(geometry: g)
    n.position = p
    n.scale = scale
    return n
}

func cylNode(_ m: SCNMaterial, r: CGFloat, h: CGFloat, axis: Axis = .y, at p: SCNVector3) -> SCNNode {
    let g = SCNCylinder(radius: r, height: h)
    g.radialSegmentCount = 40
    g.materials = [m]
    let n = SCNNode(geometry: g)
    orient(n, axis)
    n.position = p
    return n
}

func torusNode(_ m: SCNMaterial, ring: CGFloat, pipe: CGFloat, axis: Axis = .y, at p: SCNVector3) -> SCNNode {
    let g = SCNTorus(ringRadius: ring, pipeRadius: pipe)
    g.ringSegmentCount = 56
    g.pipeSegmentCount = 24
    g.materials = [m]
    let n = SCNNode(geometry: g)
    orient(n, axis)
    n.position = p
    return n
}

func coneNode(_ m: SCNMaterial, top: CGFloat, bottom: CGFloat, h: CGFloat, axis: Axis = .y, at p: SCNVector3) -> SCNNode {
    let g = SCNCone(topRadius: top, bottomRadius: bottom, height: h)
    g.radialSegmentCount = 36
    g.materials = [m]
    let n = SCNNode(geometry: g)
    orient(n, axis)
    n.position = p
    return n
}

func group(_ name: String? = nil, _ children: [SCNNode]) -> SCNNode {
    let n = SCNNode()
    n.name = name
    children.forEach { n.addChildNode($0) }
    return n
}

extension SCNMaterial {
    static func pbr(_ color: UIColor, metal: CGFloat = 0, rough: CGFloat = 0.5, emission: UIColor? = nil, clearCoat: Bool = false) -> SCNMaterial {
        let m = SCNMaterial()
        m.lightingModel = .physicallyBased
        m.diffuse.contents = color
        m.metalness.contents = metal
        m.roughness.contents = rough
        if let emission = emission { m.emission.contents = emission }
        if clearCoat {
            m.clearCoat.contents = 1.0
            m.clearCoatRoughness.contents = 0.06
        }
        return m
    }
}

extension SCNNode {
    /// Bounding box of every piece of geometry under this node, in this node's parent space.
    func deepBounds() -> (min: SCNVector3, max: SCNVector3)? {
        var lo = SCNVector3(Float.greatestFiniteMagnitude, Float.greatestFiniteMagnitude, Float.greatestFiniteMagnitude)
        var hi = SCNVector3(-Float.greatestFiniteMagnitude, -Float.greatestFiniteMagnitude, -Float.greatestFiniteMagnitude)
        var found = false
        let ref = parent
        enumerateHierarchy { node, _ in
            guard let g = node.geometry else { return }
            let (a, b) = g.boundingBox
            for cx in [a.x, b.x] { for cy in [a.y, b.y] { for cz in [a.z, b.z] {
                let p = node.convertPosition(V(cx, cy, cz), to: ref)
                lo = V(Swift.min(lo.x, p.x), Swift.min(lo.y, p.y), Swift.min(lo.z, p.z))
                hi = V(Swift.max(hi.x, p.x), Swift.max(hi.y, p.y), Swift.max(hi.z, p.z))
                found = true
            } } }
        }
        return found ? (lo, hi) : nil
    }
}

/// Soft round dot used for particles (exhaust puffs, sparkles).
let softDotImage: UIImage = {
    let size = CGSize(width: 64, height: 64)
    return UIGraphicsImageRenderer(size: size).image { ctx in
        let colors = [UIColor.white.cgColor, UIColor.white.withAlphaComponent(0).cgColor] as CFArray
        let grad = CGGradient(colorsSpace: CGColorSpaceCreateDeviceRGB(), colors: colors, locations: [0, 1])!
        ctx.cgContext.drawRadialGradient(grad, startCenter: CGPoint(x: 32, y: 32), startRadius: 0,
                                         endCenter: CGPoint(x: 32, y: 32), endRadius: 32, options: [])
    }
}()

func verticalGradient(_ top: UIColor, _ bottom: UIColor, size: CGSize = CGSize(width: 16, height: 512)) -> UIImage {
    UIGraphicsImageRenderer(size: size).image { ctx in
        let colors = [top.cgColor, bottom.cgColor] as CFArray
        let grad = CGGradient(colorsSpace: CGColorSpaceCreateDeviceRGB(), colors: colors, locations: [0, 1])!
        ctx.cgContext.drawLinearGradient(grad, start: .zero, end: CGPoint(x: 0, y: size.height), options: [])
    }
}

func capsuleNode(_ m: SCNMaterial, r: CGFloat, h: CGFloat, axis: Axis = .y, at p: SCNVector3) -> SCNNode {
    let g = SCNCapsule(capRadius: r, height: h)
    g.radialSegmentCount = 32
    g.materials = [m]
    let n = SCNNode(geometry: g)
    orient(n, axis)
    n.position = p
    return n
}

/// Soft dark patch that sits under a car so it looks planted on the floor.
let contactShadowImage: UIImage = {
    let w = 256, h = 128
    var px = [UInt8](repeating: 0, count: w * h * 4)
    for y in 0..<h {
        for x in 0..<w {
            let u = abs(Float(x) / Float(w - 1) * 2 - 1), v = abs(Float(y) / Float(h - 1) * 2 - 1)
            let d = pow(pow(u, 4) + pow(v, 4), 0.25)
            let t = max(0, min(1, (d - 0.35) / 0.65))
            let a = 0.88 * (1 - t * t * (3 - 2 * t))
            px[(y * w + x) * 4 + 3] = UInt8(a * 255)
        }
    }
    let ctx = CGContext(data: &px, width: w, height: h, bitsPerComponent: 8, bytesPerRow: w * 4,
                        space: CGColorSpaceCreateDeviceRGB(), bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue)!
    return UIImage(cgImage: ctx.makeImage()!)
}()
