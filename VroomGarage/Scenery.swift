import SceneKit
import UIKit

/// The workshop around the turntable: block walls, a pegboard of tools, a workbench, a red tool chest,
/// tyre stacks, oil drums, a roll-up door and a test track painted on the concrete floor.
enum Workshop {
    static let floorY: Float = -0.25

    static func make() -> SCNNode {
        let root = SCNNode()
        root.name = "workshop"
        let G = floorY

        // Walls (single-sided, facing in, so the bird's-eye camera can see over them)
        let wall = textured(blockWallImage, repeatX: 14, repeatY: 5, rough: 0.85)
        root.addChildNode(plane(wall, w: 40, h: 10, at: V(0, G + 5, -12)))
        for s: Float in [1, -1] {
            let side = plane(wall, w: 40, h: 10, at: V(s * 17, G + 5, 4))
            side.eulerAngles.y = -s * .pi / 2
            root.addChildNode(side)
        }
        let lower = SCNMaterial.pbr(UIColor(white: 0.28, alpha: 1), rough: 0.7)
        root.addChildNode(plane(lower, w: 40, h: 1.2, at: V(0, G + 0.6, -11.98)))
        root.addChildNode(plane(textured(hazardImage, repeatX: 60, repeatY: 1, rough: 0.5), w: 40, h: 0.2, at: V(0, G + 1.3, -11.97)))

        // Pegboard with tools, workbench below
        root.addChildNode(plane(textured(pegboardImage, repeatX: 22, repeatY: 10, rough: 0.8), w: 5.6, h: 2.5, at: V(-2.6, G + 2.75, -11.95)))
        root.addChildNode(tools(at: V(-2.6, G + 2.75, -11.9)))
        root.addChildNode(workbench(at: V(-2.6, G, -11.35)))

        // Roll-up door with a frame and a row of little windows
        root.addChildNode(plane(textured(rollupImage, repeatX: 1, repeatY: 6, rough: 0.5), w: 4.8, h: 4.6, at: V(4.6, G + 2.3, -11.96)))
        let frame = SCNMaterial.pbr(UIColor(white: 0.18, alpha: 1), metal: 0.6, rough: 0.4)
        root.addChildNode(boxNode(frame, 5.2, 0.25, 0.2, at: V(4.6, G + 4.72, -11.9)))
        for s: Float in [1, -1] { root.addChildNode(boxNode(frame, 0.22, 4.8, 0.2, at: V(4.6 + s * 2.5, G + 2.4, -11.9))) }
        let winGlass = SCNMaterial.pbr(UIColor(red: 0.55, green: 0.75, blue: 0.95, alpha: 1), rough: 0.1,
                                       emission: UIColor(red: 0.35, green: 0.5, blue: 0.7, alpha: 1))
        for i in 0..<4 { root.addChildNode(boxNode(winGlass, 0.8, 0.35, 0.02, r: 0.05, at: V(3.1 + Float(i) * 1.0, G + 3.3, -11.93))) }

        // Banner and shelf of paint cans
        root.addChildNode(plane(textured(checkerImage, repeatX: 14, repeatY: 2, rough: 0.6), w: 6.0, h: 0.8, at: V(-2.6, G + 4.6, -11.95)))
        root.addChildNode(shelf(at: V(10.0, G + 2.6, -11.75)))

        root.addChildNode(toolChest(at: V(-8.2, G, -10.9)))
        root.addChildNode(tyreStack(count: 4, at: V(8.6, G, -10.4)))
        root.addChildNode(tyreStack(count: 3, at: V(9.9, G, -9.4)))
        root.addChildNode(drum(UIColor(red: 0.1, green: 0.3, blue: 0.8, alpha: 1), at: V(-10.9, G, -9.6)))
        root.addChildNode(drum(UIColor(red: 0.8, green: 0.1, blue: 0.08, alpha: 1), at: V(-10.2, G, -10.9)))
        for p in [V(-7.6, G, -3.6), V(7.8, G, -4.6), V(-8.4, G, 2.2), V(8.6, G, 1.4)] { root.addChildNode(cone(at: p)) }

        root.addChildNode(track())
        return root
    }

    // MARK: Floor track

    static func track() -> SCNNode {
        let root = SCNNode()
        let R = GarageScene.roadRadius
        let inner: CGFloat = CGFloat(R) - 0.9, outer: CGFloat = CGFloat(R) + 0.9
        let ring = UIBezierPath(arcCenter: .zero, radius: outer, startAngle: 0, endAngle: .pi * 2, clockwise: true)
        ring.append(UIBezierPath(arcCenter: .zero, radius: inner, startAngle: 0, endAngle: .pi * 2, clockwise: false))
        ring.flatness = 0.01
        let shape = SCNShape(path: ring, extrusionDepth: 0.01)
        shape.materials = [.pbr(UIColor(white: 0.13, alpha: 1), rough: 0.6)]
        let asphalt = SCNNode(geometry: shape)
        asphalt.eulerAngles.x = -.pi / 2
        asphalt.position.y = floorY + 0.005
        root.addChildNode(asphalt)

        let white = SCNMaterial.pbr(UIColor(white: 0.92, alpha: 1), rough: 0.5)
        let red = SCNMaterial.pbr(UIColor(red: 0.85, green: 0.08, blue: 0.08, alpha: 1), rough: 0.5)
        let dashes = 36
        for i in 0..<dashes where i % 2 == 0 {
            let a = Float(i) / Float(dashes) * 2 * .pi
            let d = boxNode(white, 0.06, 0.012, 0.5, at: V(cos(a) * R, floorY + 0.012, -sin(a) * R))
            d.eulerAngles.y = a
            root.addChildNode(d)
        }
        let curbs = 64
        for i in 0..<curbs {
            let a = Float(i) / Float(curbs) * 2 * .pi
            for (rad, w) in [(Float(outer) + 0.12, Float(0.24)), (Float(inner) - 0.12, Float(0.24))] {
                let c = boxNode(i % 2 == 0 ? red : white, CGFloat(w), 0.014, CGFloat(rad) * 2 * .pi / CGFloat(curbs) + 0.01,
                                at: V(cos(a) * rad, floorY + 0.012, -sin(a) * rad))
                c.eulerAngles.y = a
                root.addChildNode(c)
            }
        }
        // Start / finish line
        let finish = SCNPlane(width: 1.8, height: 0.45)
        finish.materials = [textured(checkerImage, repeatX: 8, repeatY: 2, rough: 0.5)]
        let f = SCNNode(geometry: finish)
        f.eulerAngles.x = -.pi / 2
        f.position = V(R, floorY + 0.016, -0.6)
        root.addChildNode(f)
        return root
    }

    // MARK: Props

    static func tools(at p: SCNVector3) -> SCNNode {
        let n = SCNNode()
        n.position = p
        let steel = SCNMaterial.pbr(UIColor(white: 0.8, alpha: 1), metal: 1, rough: 0.25)
        let redGrip = SCNMaterial.pbr(UIColor(red: 0.85, green: 0.1, blue: 0.1, alpha: 1), rough: 0.4)
        let yellowGrip = SCNMaterial.pbr(UIColor(red: 1, green: 0.75, blue: 0.05, alpha: 1), rough: 0.4)
        let wood = SCNMaterial.pbr(UIColor(red: 0.6, green: 0.4, blue: 0.22, alpha: 1), rough: 0.7)
        // Wrenches, biggest to smallest
        for (i, len) in [Float(1.1), 0.95, 0.8, 0.65].enumerated() {
            let x = -2.2 + Float(i) * 0.38
            n.addChildNode(capsuleNode(steel, r: 0.045, h: CGFloat(len), at: V(x, 0.15, 0.02)))
            n.addChildNode(torusNode(steel, ring: 0.07, pipe: 0.03, axis: .z, at: V(x, 0.15 + len / 2 + 0.05, 0.02)))
            n.addChildNode(torusNode(steel, ring: 0.06, pipe: 0.03, axis: .z, at: V(x, 0.15 - len / 2 - 0.04, 0.02)))
        }
        // Hammer
        n.addChildNode(capsuleNode(wood, r: 0.05, h: 0.9, at: V(-0.55, 0.0, 0.03)))
        n.addChildNode(boxNode(steel, 0.42, 0.14, 0.12, r: 0.03, at: V(-0.55, 0.48, 0.03)))
        // Screwdrivers
        for (i, grip) in [redGrip, yellowGrip, redGrip].enumerated() {
            let x = 0.0 + Float(i) * 0.3
            n.addChildNode(capsuleNode(grip, r: 0.06, h: 0.32, at: V(x, 0.45, 0.03)))
            n.addChildNode(cylNode(steel, r: 0.015, h: 0.5, at: V(x, 0.05, 0.03)))
        }
        // Pliers
        let a = rod(redGrip, V(1.05, -0.4, 0.03), V(1.25, 0.25, 0.03), r: 0.04)
        let b = rod(redGrip, V(1.45, -0.4, 0.03), V(1.25, 0.25, 0.03), r: 0.04)
        n.addChildNode(a); n.addChildNode(b)
        n.addChildNode(coneNode(steel, top: 0.01, bottom: 0.06, h: 0.3, at: V(1.25, 0.4, 0.03)))
        // A coil of yellow air hose
        n.addChildNode(torusNode(yellowGrip, ring: 0.38, pipe: 0.04, axis: .z, at: V(2.1, 0.2, 0.05)))
        n.addChildNode(torusNode(yellowGrip, ring: 0.34, pipe: 0.04, axis: .z, at: V(2.12, 0.18, 0.09)))
        return n
    }

    static func workbench(at p: SCNVector3) -> SCNNode {
        let n = SCNNode()
        n.position = p
        let wood = SCNMaterial.pbr(UIColor(red: 0.62, green: 0.42, blue: 0.24, alpha: 1), rough: 0.6)
        let steel = SCNMaterial.pbr(UIColor(white: 0.25, alpha: 1), metal: 0.8, rough: 0.4)
        n.addChildNode(boxNode(wood, 5.2, 0.12, 1.0, r: 0.02, at: V(0, 1.0, 0)))
        n.addChildNode(boxNode(steel, 5.0, 0.06, 0.9, at: V(0, 0.3, 0)))
        for x: Float in [-2.45, 2.45] { for z: Float in [-0.4, 0.4] {
            n.addChildNode(boxNode(steel, 0.08, 1.0, 0.08, at: V(x, 0.5, z)))
        } }
        // vise
        n.addChildNode(boxNode(steel, 0.35, 0.22, 0.3, r: 0.03, at: V(1.9, 1.17, 0.25)))
        n.addChildNode(cylNode(SCNMaterial.pbr(.white, metal: 1, rough: 0.2), r: 0.025, h: 0.5, axis: .z, at: V(1.9, 1.15, 0.45)))
        // a small red toolbox and a can on the bench
        let red = SCNMaterial.pbr(UIColor(red: 0.8, green: 0.06, blue: 0.06, alpha: 1), rough: 0.3, clearCoat: true)
        n.addChildNode(boxNode(red, 0.8, 0.35, 0.4, r: 0.03, at: V(-1.4, 1.24, 0)))
        n.addChildNode(rod(steel, V(-1.65, 1.44, 0), V(-1.15, 1.44, 0), r: 0.02))
        n.addChildNode(cylNode(SCNMaterial.pbr(UIColor(red: 0.1, green: 0.5, blue: 0.2, alpha: 1), rough: 0.4), r: 0.12, h: 0.3, at: V(0.2, 1.21, 0.1)))
        // boxes on the lower shelf
        n.addChildNode(boxNode(SCNMaterial.pbr(UIColor(red: 0.7, green: 0.55, blue: 0.35, alpha: 1), rough: 0.9), 0.9, 0.5, 0.6, r: 0.01, at: V(-1.6, 0.58, 0)))
        n.addChildNode(boxNode(SCNMaterial.pbr(UIColor(red: 0.7, green: 0.55, blue: 0.35, alpha: 1), rough: 0.9), 0.7, 0.4, 0.6, r: 0.01, at: V(0.9, 0.53, 0)))
        return n
    }

    static func toolChest(at p: SCNVector3) -> SCNNode {
        let n = SCNNode()
        n.position = p
        let red = SCNMaterial.pbr(UIColor(red: 0.78, green: 0.04, blue: 0.04, alpha: 1), metal: 0.3, rough: 0.3, clearCoat: true)
        let dark = SCNMaterial.pbr(UIColor(white: 0.05, alpha: 1), rough: 0.6)
        let chrome = SCNMaterial.pbr(.white, metal: 1, rough: 0.1)
        n.addChildNode(boxNode(red, 2.2, 1.8, 0.95, r: 0.05, at: V(0, 1.05, 0)))
        n.addChildNode(boxNode(red, 2.1, 0.8, 0.85, r: 0.05, at: V(0, 2.4, -0.03)))
        n.addChildNode(boxNode(dark, 2.22, 0.06, 0.97, at: V(0, 1.97, 0)))
        for (i, y) in [Float(0.45), 0.8, 1.1, 1.38, 1.62, 1.82].enumerated() {
            n.addChildNode(boxNode(dark, 2.12, 0.02, 0.02, at: V(0, y + 0.13, 0.48)))
            n.addChildNode(boxNode(chrome, 1.6, 0.04, 0.05, r: 0.02, at: V(0, y + (i == 0 ? 0.1 : 0.0), 0.5)))
        }
        for y: Float in [2.25, 2.55] { n.addChildNode(boxNode(chrome, 1.5, 0.04, 0.05, r: 0.02, at: V(0, y, 0.43))) }
        for x: Float in [-0.95, 0.95] { for z: Float in [-0.35, 0.35] {
            n.addChildNode(cylNode(dark, r: 0.1, h: 0.08, axis: .z, at: V(x, 0.1, z)))
        } }
        return n
    }

    static func tyreStack(count: Int, at p: SCNVector3) -> SCNNode {
        let n = SCNNode()
        n.position = p
        let rubber = SCNMaterial.pbr(UIColor(white: 0.07, alpha: 1), rough: 0.85)
        for i in 0..<count {
            let t = torusNode(rubber, ring: 0.45, pipe: 0.2, at: V(Float(i % 2) * 0.05, 0.2 + Float(i) * 0.39, 0))
            t.scale = V(1, 0.95, 1)
            n.addChildNode(t)
        }
        return n
    }

    static func drum(_ color: UIColor, at p: SCNVector3) -> SCNNode {
        let n = SCNNode()
        n.position = p
        let m = SCNMaterial.pbr(color, metal: 0.4, rough: 0.4)
        n.addChildNode(cylNode(m, r: 0.45, h: 1.3, at: V(0, 0.65, 0)))
        for y: Float in [0.35, 0.95] { n.addChildNode(torusNode(m, ring: 0.45, pipe: 0.03, at: V(0, y, 0))) }
        n.addChildNode(cylNode(SCNMaterial.pbr(UIColor(white: 0.7, alpha: 1), metal: 1, rough: 0.3), r: 0.06, h: 0.04, at: V(0.2, 1.31, 0.1)))
        return n
    }

    static func cone(at p: SCNVector3) -> SCNNode {
        let n = SCNNode()
        n.position = p
        let orange = SCNMaterial.pbr(UIColor(red: 1, green: 0.4, blue: 0.0, alpha: 1), rough: 0.5)
        let white = SCNMaterial.pbr(.white, rough: 0.4)
        n.addChildNode(boxNode(orange, 0.7, 0.06, 0.7, r: 0.04, at: V(0, 0.03, 0)))
        n.addChildNode(coneNode(orange, top: 0.04, bottom: 0.26, h: 0.9, at: V(0, 0.5, 0)))
        n.addChildNode(coneNode(white, top: 0.135, bottom: 0.175, h: 0.15, at: V(0, 0.5, 0)))
        return n
    }

    static func shelf(at p: SCNVector3) -> SCNNode {
        let n = SCNNode()
        n.position = p
        let steel = SCNMaterial.pbr(UIColor(white: 0.3, alpha: 1), metal: 0.8, rough: 0.4)
        let colors: [UIColor] = [.systemRed, .systemBlue, .systemYellow, .systemGreen, .systemOrange, .white]
        for (row, y) in [Float(0), 1.0].enumerated() {
            n.addChildNode(boxNode(steel, 3.0, 0.06, 0.45, at: V(0, y, 0)))
            for i in 0..<5 {
                let c = SCNMaterial.pbr(colors[(i + row * 2) % colors.count], metal: 0.3, rough: 0.35)
                n.addChildNode(cylNode(c, r: 0.16, h: 0.38, at: V(-1.15 + Float(i) * 0.58, y + 0.22, 0)))
            }
        }
        return n
    }

    // MARK: Helpers

    static func plane(_ m: SCNMaterial, w: CGFloat, h: CGFloat, at p: SCNVector3) -> SCNNode {
        let g = SCNPlane(width: w, height: h)
        g.materials = [m]
        let n = SCNNode(geometry: g)
        n.position = p
        return n
    }

    static func textured(_ img: UIImage, repeatX: Float, repeatY: Float, rough: CGFloat) -> SCNMaterial {
        let m = SCNMaterial.pbr(.white, rough: rough)
        m.diffuse.contents = img
        m.diffuse.wrapS = .repeat
        m.diffuse.wrapT = .repeat
        m.diffuse.contentsTransform = SCNMatrix4MakeScale(repeatX, repeatY, 1)
        return m
    }
}

// MARK: - Generated textures

private func tile(_ w: CGFloat, _ h: CGFloat, _ draw: (CGContext, CGSize) -> Void) -> UIImage {
    let size = CGSize(width: w, height: h)
    return UIGraphicsImageRenderer(size: size).image { draw($0.cgContext, size) }
}

let concreteImage: UIImage = tile(256, 256) { c, s in
    c.setFillColor(UIColor(white: 0.5, alpha: 1).cgColor)
    c.fill(CGRect(origin: .zero, size: s))
    var rng = SeededRandom(seed: 7)
    for _ in 0..<2600 {
        let v = 0.38 + rng.next() * 0.25
        c.setFillColor(UIColor(white: CGFloat(v), alpha: 0.5).cgColor)
        let r = CGFloat(1 + rng.next() * 2.5)
        c.fillEllipse(in: CGRect(x: CGFloat(rng.next()) * s.width, y: CGFloat(rng.next()) * s.height, width: r, height: r))
    }
}

let blockWallImage: UIImage = tile(128, 64) { c, s in
    c.setFillColor(UIColor(white: 0.8, alpha: 1).cgColor)
    c.fill(CGRect(origin: .zero, size: s))
    c.setFillColor(UIColor(white: 0.62, alpha: 1).cgColor)
    c.fill(CGRect(x: 0, y: 0, width: s.width, height: 3))
    c.fill(CGRect(x: 0, y: 32, width: s.width, height: 3))
    c.fill(CGRect(x: 0, y: 0, width: 3, height: 32))
    c.fill(CGRect(x: 64, y: 32, width: 3, height: 32))
}

let pegboardImage: UIImage = tile(32, 32) { c, s in
    c.setFillColor(UIColor(red: 0.78, green: 0.64, blue: 0.46, alpha: 1).cgColor)
    c.fill(CGRect(origin: .zero, size: s))
    c.setFillColor(UIColor(red: 0.25, green: 0.18, blue: 0.1, alpha: 1).cgColor)
    c.fillEllipse(in: CGRect(x: 12, y: 12, width: 8, height: 8))
}

let rollupImage: UIImage = tile(64, 64) { c, s in
    c.setFillColor(UIColor(white: 0.86, alpha: 1).cgColor)
    c.fill(CGRect(origin: .zero, size: s))
    c.setFillColor(UIColor(white: 0.6, alpha: 1).cgColor)
    c.fill(CGRect(x: 0, y: 0, width: s.width, height: 6))
    c.setFillColor(UIColor(white: 0.97, alpha: 1).cgColor)
    c.fill(CGRect(x: 0, y: 6, width: s.width, height: 3))
}

let hazardImage: UIImage = tile(64, 32) { c, s in
    c.setFillColor(UIColor(red: 1, green: 0.8, blue: 0.0, alpha: 1).cgColor)
    c.fill(CGRect(origin: .zero, size: s))
    c.setFillColor(UIColor(white: 0.05, alpha: 1).cgColor)
    let p = UIBezierPath()
    p.move(to: CGPoint(x: 0, y: 32)); p.addLine(to: CGPoint(x: 16, y: 0)); p.addLine(to: CGPoint(x: 32, y: 0)); p.addLine(to: CGPoint(x: 16, y: 32)); p.close()
    p.move(to: CGPoint(x: 32, y: 32)); p.addLine(to: CGPoint(x: 48, y: 0)); p.addLine(to: CGPoint(x: 64, y: 0)); p.addLine(to: CGPoint(x: 48, y: 32)); p.close()
    c.addPath(p.cgPath)
    c.fillPath()
}

let checkerImage: UIImage = tile(32, 32) { c, s in
    c.setFillColor(UIColor.white.cgColor)
    c.fill(CGRect(origin: .zero, size: s))
    c.setFillColor(UIColor(white: 0.05, alpha: 1).cgColor)
    c.fill(CGRect(x: 0, y: 0, width: 16, height: 16))
    c.fill(CGRect(x: 16, y: 16, width: 16, height: 16))
}

let diamondPlateImage: UIImage = tile(64, 64) { c, s in
    c.setFillColor(UIColor(white: 0.42, alpha: 1).cgColor)
    c.fill(CGRect(origin: .zero, size: s))
    for (x, y, a) in [(CGFloat(16), CGFloat(16), CGFloat(0.6)), (48, 48, 0.6), (48, 16, -0.6), (16, 48, -0.6)] {
        c.saveGState()
        c.translateBy(x: x, y: y)
        c.rotate(by: a)
        c.setFillColor(UIColor(white: 0.75, alpha: 1).cgColor)
        c.fillEllipse(in: CGRect(x: -11, y: -3, width: 22, height: 6))
        c.setFillColor(UIColor(white: 0.25, alpha: 1).cgColor)
        c.fillEllipse(in: CGRect(x: -10, y: 0, width: 20, height: 3))
        c.restoreGState()
    }
}

/// Tiny deterministic random numbers so the workshop looks the same every launch.
struct SeededRandom {
    private var state: UInt64
    init(seed: UInt64) { state = seed &* 0x9E3779B97F4A7C15 }
    mutating func next() -> Double {
        state = state &* 6364136223846793005 &+ 1442695040888963407
        return Double(state >> 11) / Double(1 << 53)
    }
}
