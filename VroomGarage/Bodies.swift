import SceneKit
import UIKit
import simd

/// A spot on the body where an add-on part bolts on, and how much room there is across the car.
struct Anchor {
    let p: SCNVector3
    let width: Float
    init(_ x: Float, _ y: Float, w: Float) { p = V(x, y, 0); width = w }
}

/// What a body build hands back: the shell plus the information stickers and stripes need.
struct BodyBuild {
    let node: SCNNode
    /// Side outline (car space XY) of the flat side panel where stickers go.
    let panel: UIBezierPath
    /// How far that flat side is from the centre line.
    let panelZ: Float
    /// How much the rounded edges eat into the flat side.
    let panelInset: CGFloat
    /// Racing stripe runs along the top centre line.
    let stripes: [[CGPoint]]
    /// The rounded skin, when the body has one (stickers wrap onto it).
    var loft: Loft? = nil
}

struct BodyStyle: Identifiable {
    let id: String
    /// Wheel radius the body was designed around (wells are centred at this height).
    let wheelRadius: Float
    let wheelbase: Float
    /// Distance between the left and right wheel centres.
    let track: Float
    let wheelWidth: Float
    /// Where the driver sits (bottom of the torso) and how big they are.
    let seat: SCNVector3
    let driverScale: Float
    let hood: Anchor
    let nose: Anchor
    let roof: Anchor
    let deck: Anchor
    let tail: Anchor
    /// Builds the shell for wheels of the given radius (wells grow to fit).
    let build: (CarMaterials, Float) -> BodyBuild

    func anchor(_ slot: AddonSlot) -> Anchor {
        switch slot {
        case .engine: return hood
        case .front: return nose
        case .roof: return roof
        case .back: return deck
        }
    }
}

// MARK: - Shape helpers

extension UIBezierPath {
    func l(_ x: CGFloat, _ y: CGFloat) { addLine(to: CGPoint(x: x, y: y)) }
    func q(_ x: CGFloat, _ y: CGFloat, _ cx: CGFloat, _ cy: CGFloat) {
        addQuadCurve(to: CGPoint(x: x, y: y), controlPoint: CGPoint(x: cx, y: cy))
    }
}

/// A rounded (not bevelled) edge for extruded shapes.
let roundChamfer: UIBezierPath = {
    let p = UIBezierPath()
    p.move(to: CGPoint(x: 0, y: 1))
    p.addQuadCurve(to: CGPoint(x: 1, y: 0), controlPoint: CGPoint(x: 1, y: 1))
    return p
}()

/// Extrude a side silhouette (XY, +X forward) across the car's width (Z), centred on z = 0.
func extrude(_ path: UIBezierPath, depth: CGFloat, chamfer: CGFloat, _ mat: SCNMaterial) -> SCNNode {
    let p = path.copy() as! UIBezierPath
    p.flatness = 0.003
    let s = SCNShape(path: p, extrusionDepth: depth)
    s.chamferRadius = chamfer
    if chamfer > 0 { s.chamferProfile = roundChamfer }
    s.materials = [mat]
    return SCNNode(geometry: s)
}

/// A car's side outline: the bottom edge from front to rear with wheel wells cut out,
/// then `top` draws from the rear-bottom corner over the car and back to the front-bottom corner.
func sideOutline(front: CGFloat, rear: CGFloat, bottom: CGFloat, wells: [CGFloat], wellY: CGFloat, wellR: CGFloat,
                 top: (UIBezierPath) -> Void) -> UIBezierPath {
    let p = UIBezierPath()
    // Start a little way along the bottom so closing the outline never makes a zero-length edge
    // (those turn into spikes once the edges are rounded).
    p.move(to: CGPoint(x: front - 0.05, y: bottom))
    for x in wells.sorted(by: >) {
        let dy = bottom - wellY
        guard abs(dy) < wellR else { continue }
        let a0 = asin(dy / wellR)
        p.l(x + wellR * cos(a0), bottom)
        p.addArc(withCenter: CGPoint(x: x, y: wellY), radius: wellR, startAngle: a0, endAngle: .pi - a0, clockwise: true)
    }
    p.l(rear, bottom)
    top(p)
    p.close()
    return p
}

/// A cylinder running from `a` to `b`.
func rod(_ m: SCNMaterial, _ a: SCNVector3, _ b: SCNVector3, r: CGFloat) -> SCNNode {
    let va = simd_float3(a.x, a.y, a.z), vb = simd_float3(b.x, b.y, b.z)
    let d = vb - va
    let g = SCNCylinder(radius: r, height: CGFloat(simd_length(d)))
    g.radialSegmentCount = 20
    g.materials = [m]
    let n = SCNNode(geometry: g)
    n.simdPosition = (va + vb) / 2
    n.simdOrientation = simd_quatf(from: simd_float3(0, 1, 0), to: simd_normalize(d))
    return n
}

// MARK: - Shared pieces

enum Parts {
    /// Glass cabin with a painted roof and window frames on both sides, so the driver shows through.
    static func greenhouse(_ m: CarMaterials, rear0: CGPoint, rear1: CGPoint, front1: CGPoint, front0: CGPoint,
                           width: CGFloat, pillars: [CGFloat] = [], post: CGFloat = 0.06,
                           sink: CGFloat = 0.14, tumble: Float = 0.3) -> [SCNNode] {
        var nodes: [SCNNode] = []
        let core = UIBezierPath()
        core.move(to: CGPoint(x: rear0.x + 0.03, y: rear0.y - 0.08))
        core.l(rear1.x, rear1.y)
        core.l(front1.x, front1.y)
        core.l(front0.x - 0.03, front0.y - 0.08)
        core.close()
        nodes.append(extrude(core, depth: width - 0.05, chamfer: 0.05, m.glass))

        let roof = UIBezierPath()
        roof.move(to: CGPoint(x: rear1.x - 0.03, y: rear1.y - 0.045))
        roof.l(rear1.x + 0.01, rear1.y + 0.035)
        roof.l(front1.x - 0.01, front1.y + 0.035)
        roof.l(front1.x + 0.04, front1.y - 0.045)
        roof.close()
        nodes.append(extrude(roof, depth: width + 0.01, chamfer: 0.04, m.paint))

        // Side frames: the cabin outline with the window openings punched out.
        let frame = UIBezierPath()
        frame.move(to: CGPoint(x: rear0.x, y: rear0.y - sink))
        frame.l(rear0.x, rear0.y)
        frame.l(rear1.x, rear1.y + 0.02)
        frame.l(front1.x, front1.y + 0.02)
        frame.l(front0.x, front0.y)
        frame.l(front0.x, front0.y - sink)
        frame.close()
        let ylo = max(rear0.y, front0.y) + 0.035
        let yhi = min(rear1.y, front1.y) - post
        func edgeX(_ a: CGPoint, _ b: CGPoint, _ y: CGFloat, inward: CGFloat) -> CGFloat {
            let dy = b.y - a.y, dx = b.x - a.x
            let x = a.x + dx * (y - a.y) / dy
            let len = (dx * dx + dy * dy).squareRoot()
            return x + inward * post * len / abs(dy)
        }
        let cuts = [-CGFloat.greatestFiniteMagnitude] + pillars.sorted() + [CGFloat.greatestFiniteMagnitude]
        for i in 0..<(cuts.count - 1) {
            let s = cuts[i] + (i == 0 ? 0 : post / 2)
            let e = cuts[i + 1] - (i == cuts.count - 2 ? 0 : post / 2)
            let a = CGPoint(x: max(edgeX(rear0, rear1, ylo, inward: 1), s), y: ylo)
            let b = CGPoint(x: max(edgeX(rear0, rear1, yhi, inward: 1), s), y: yhi)
            let c = CGPoint(x: min(edgeX(front0, front1, yhi, inward: -1), e), y: yhi)
            let d = CGPoint(x: min(edgeX(front0, front1, ylo, inward: -1), e), y: ylo)
            guard c.x - b.x > 0.08, d.x - a.x > 0.08 else { continue }
            frame.move(to: a); frame.l(b.x, b.y); frame.l(c.x, c.y); frame.l(d.x, d.y); frame.close()
        }
        frame.usesEvenOddFillRule = true
        for s: CGFloat in [1, -1] {
            let f = extrude(frame, depth: 0.04, chamfer: 0.012, m.paint)
            f.position.z = Float(s * width / 2)
            nodes.append(f)
        }
        // Lean the cabin sides in toward the roof.
        let base = Float(min(rear0.y, front0.y))
        nodes.forEach { tumblehome($0, from: base, rate: tumble) }
        return nodes
    }



    static func roundLamp(_ m: CarMaterials, x: Float, y: Float, z: Float, r: CGFloat, lens: SCNMaterial? = nil) -> [SCNNode] {
        [torusNode(m.chrome, ring: r, pipe: r * 0.22, axis: .x, at: V(x, y, z)),
         sphereNode(lens ?? m.headlight, r: r * 0.95, at: V(x - Float(r) * 0.25, y, z), scale: V(0.4, 1, 1))]
    }

    static func mirrors(_ m: CarMaterials, x: Float, y: Float, z: Float) -> [SCNNode] {
        var out: [SCNNode] = []
        for s: Float in [1, -1] {
            out.append(boxNode(m.trim, 0.08, 0.04, 0.14, r: 0.015, at: V(x, y, s * (z - 0.05))))
            out.append(boxNode(m.paint, 0.1, 0.13, 0.17, r: 0.045, at: V(x - 0.02, y + 0.03, s * (z + 0.06))))
            out.append(boxNode(m.chrome, 0.02, 0.1, 0.13, r: 0.02, at: V(x - 0.075, y + 0.03, s * (z + 0.06))))
        }
        return out
    }


    static func plate(_ m: CarMaterials, x: Float, y: Float, facing: Float) -> [SCNNode] {
        [boxNode(m.white, 0.02, 0.15, 0.34, r: 0.01, at: V(x, y, 0)),
         boxNode(m.trim, 0.012, 0.17, 0.36, r: 0.01, at: V(x - facing * 0.008, y, 0))]
    }

    static func exhaust(_ m: CarMaterials, x: Float, y: Float, zs: [Float], r: CGFloat = 0.05) -> [SCNNode] {
        zs.flatMap { z in
            [cylNode(m.chrome, r: r, h: 0.3, axis: .x, at: V(x, y, z)),
             cylNode(m.grille, r: r * 0.7, h: 0.31, axis: .x, at: V(x, y, z))]
        }
    }

    /// Black grille panel with chrome slats.
    static func grille(_ m: CarMaterials, x: Float, y: Float, h: CGFloat, w: CGFloat, slats: Int, vertical: Bool = false) -> [SCNNode] {
        var out = [boxNode(m.grille, 0.04, h, w, r: 0.02, at: V(x, y, 0))]
        for i in 0..<slats {
            let t = (Float(i) + 0.5) / Float(slats) - 0.5
            if vertical {
                out.append(boxNode(m.chrome, 0.03, h * 0.9, 0.025, at: V(x + 0.012, y, t * Float(w))))
            } else {
                out.append(boxNode(m.chrome, 0.03, 0.022, w * 0.94, at: V(x + 0.012, y + t * Float(h), 0)))
            }
        }
        // chrome surround
        out.append(boxNode(m.chrome, 0.035, 0.03, w + 0.04, r: 0.012, at: V(x + 0.005, y + Float(h) / 2, 0)))
        out.append(boxNode(m.chrome, 0.035, 0.03, w + 0.04, r: 0.012, at: V(x + 0.005, y - Float(h) / 2, 0)))
        return out
    }


    /// A rounded skin from the side outline (see `Loft`), plus its dark underside.
    static func shell(_ m: CarMaterials, _ path: UIBezierPath, _ spec: Loft.Spec) -> Loft {
        Loft(path, spec, paint: m.paint, under: m.grille)
    }

    /// Door shut-lines and other panel gaps, painted onto the curved sides.
    static func panelLines(_ loft: Loft, seams: [CGFloat], from yLo: CGFloat, to yHi: CGFloat, filler: CGPoint? = nil) -> SCNNode {
        let b = loft.outline.bounds
        let scale: CGFloat = 200
        let size = CGSize(width: b.width * scale, height: b.height * scale)
        func draw(mirror: Bool) -> UIImage {
            UIGraphicsImageRenderer(size: size).image { ctx in
                let c = ctx.cgContext
                if mirror { c.translateBy(x: size.width, y: 0); c.scaleBy(x: -1, y: 1) }
                c.translateBy(x: 0, y: size.height)
                c.scaleBy(x: scale, y: -scale)
                c.translateBy(x: -b.minX, y: -b.minY)
                c.addPath(loft.outline.cgPath)
                c.clip()
                c.setLineCap(.round)
                for x in seams {
                    c.setStrokeColor(UIColor(white: 0, alpha: 0.75).cgColor)
                    c.setLineWidth(0.013)
                    c.move(to: CGPoint(x: x, y: yLo)); c.addLine(to: CGPoint(x: x, y: yHi)); c.strokePath()
                    c.setStrokeColor(UIColor(white: 1, alpha: 0.22).cgColor)
                    c.setLineWidth(0.006)
                    c.move(to: CGPoint(x: x + 0.012, y: yLo)); c.addLine(to: CGPoint(x: x + 0.012, y: yHi)); c.strokePath()
                }
                if let f = filler {
                    let r: CGFloat = 0.065
                    let rect = CGRect(x: f.x - r, y: f.y - r, width: r * 2, height: r * 2)
                    c.setStrokeColor(UIColor(white: 0, alpha: 0.7).cgColor)
                    c.setLineWidth(0.012)
                    c.strokeEllipse(in: rect)
                }
            }
        }
        let n = loft.decal(draw(mirror: false), draw(mirror: true), rect: b, offset: 0.003, order: 4, clearCoat: false)
        n.name = "panelLines"
        return n
    }

    /// Chrome pull handles sitting flush on the curved door skin.
    static func handles(_ m: CarMaterials, _ loft: Loft, at pts: [CGPoint]) -> [SCNNode] {
        pts.flatMap { p in
            [Float(1), -1].map { s in
                let x = Float(p.x), y = Float(p.y)
                return capsuleNode(m.chrome, r: 0.02, h: 0.16, axis: .x, at: V(x, y, s * (loft.sideZ(x, y) + 0.006)))
            }
        }
    }

    /// Small lamp lenses set flush into the curved flank.
    static func flankMarkers(_ m: CarMaterials, _ loft: Loft, front: Float, rear: Float, y: Float) -> [SCNNode] {
        [Float(1), -1].flatMap { s in
            [boxNode(m.amber, 0.12, 0.045, 0.02, r: 0.01, at: V(front, y, s * loft.sideZ(front, y))),
             boxNode(m.taillight, 0.12, 0.045, 0.02, r: 0.01, at: V(rear, y, s * loft.sideZ(rear, y)))]
        }
    }

    /// A round headlamp set back into the body: dark bucket, chrome reflector, bulb and a clear cover.
    static func headlamp(_ m: CarMaterials, x: Float, y: Float, z: Float, r: CGFloat) -> [SCNNode] {
        let R = Float(r)
        return [cylNode(m.grille, r: r * 1.08, h: 0.05, axis: .x, at: V(x - 0.05, y, z)),
                torusNode(m.chrome, ring: r * 1.04, pipe: r * 0.13, axis: .x, at: V(x + 0.006, y, z)),
                sphereNode(m.reflector, r: r * 0.97, at: V(x - R * 0.3, y, z), scale: V(0.3, 1, 1)),
                sphereNode(m.headlight, r: r * 0.34, at: V(x - R * 0.05, y, z), scale: V(0.7, 1, 1)),
                sphereNode(m.lens, r: r * 0.98, at: V(x - R * 0.12, y, z), scale: V(0.22, 1, 1))]
    }

    /// A modern lamp cluster: black housing, chrome reflector, twin projectors under a clear cover.
    /// Built facing +X; `tilt` leans it back along a sloping nose.
    static func rectLamp(_ m: CarMaterials, x: Float, y: Float, z: Float, h: CGFloat, w: CGFloat, tilt: Float = 0, drl: Bool = true) -> SCNNode {
        var parts = [boxNode(m.grille, 0.06, h + 0.02, w + 0.02, r: min(h, w) * 0.3, at: V(-0.04, 0, 0)),
                     boxNode(m.reflector, 0.02, h * 0.82, w * 0.92, r: min(h, w) * 0.25, at: V(0.0, 0, 0))]
        for t: Float in [-0.24, 0.2] {
            parts.append(torusNode(m.chrome, ring: h * 0.3, pipe: h * 0.05, axis: .x, at: V(0.015, 0, t * Float(w))))
            parts.append(sphereNode(m.headlight, r: h * 0.26, at: V(0.02, 0, t * Float(w)), scale: V(0.5, 1, 1)))
        }
        if drl { parts.append(boxNode(m.headlight, 0.012, 0.02, w * 0.8, r: 0.008, at: V(0.02, -Float(h) * 0.36, 0))) }
        parts.append(boxNode(m.lens, 0.02, h + 0.01, w + 0.01, r: min(h, w) * 0.3, at: V(0.035, 0, 0)))
        let n = group(nil, parts)
        n.position = V(x, y, z)
        n.eulerAngles.z = tilt
        return n
    }

    /// A tail lamp: dark housing, glowing core and a deep red cover. Faces -X.
    static func tailLamp(_ m: CarMaterials, x: Float, y: Float, z: Float, h: CGFloat, w: CGFloat, rings: Bool = false) -> [SCNNode] {
        var out = [boxNode(m.grille, 0.05, h + 0.02, w + 0.02, r: min(h, w) * 0.25, at: V(x + 0.02, y, z)),
                   boxNode(m.taillight, 0.02, h * 0.55, w * 0.85, r: min(h, w) * 0.2, at: V(x - 0.005, y, z)),
                   boxNode(m.tailLens, 0.03, h, w, r: min(h, w) * 0.25, at: V(x - 0.015, y, z))]
        if rings {
            out.append(torusNode(m.chrome, ring: min(h, w) * 0.38, pipe: 0.008, axis: .x, at: V(x - 0.03, y, z)))
        }
        return out
    }
}

// MARK: - Bodies

extension Catalog {
    static let bodies: [BodyStyle] = [muscle, sports, formula, pickup, offroad, monster, bus]

    static let muscle = BodyStyle(
        id: "muscle", wheelRadius: 0.38, wheelbase: 2.7, track: 1.38, wheelWidth: 0.40,
        seat: V(-0.3, 0.68, 0.3), driverScale: 0.82,
        hood: Anchor(1.3, 0.96, w: 0.9), nose: Anchor(2.2, 0.42, w: 1.6), roof: Anchor(-0.25, 1.49, w: 1.3),
        deck: Anchor(-1.95, 0.97, w: 1.5), tail: Anchor(-2.2, 0.32, w: 1.4)
    ) { m, R in
        let halfW: CGFloat = 0.86
        let wellR = CGFloat(min(R + 0.07, 0.54))
        let path = sideOutline(front: 2.12, rear: -2.12, bottom: 0.34, wells: [1.35, -1.35], wellY: 0.38, wellR: wellR) { p in
            p.l(-2.17, 0.4); p.l(-2.19, 0.78); p.q(-2.02, 0.97, -2.18, 0.95); p.l(0.62, 0.98)
            p.q(2.0, 0.88, 1.45, 0.98); p.q(2.19, 0.66, 2.17, 0.84); p.l(2.19, 0.4); p.l(2.13, 0.34)
        }
        let loft = Parts.shell(m, path, Loft.Spec(halfW: Float(halfW), shoulder: 0.74, topExp: 3, lowExp: 4,
                                                  cornerF: 0.14, cornerR: 0.2, flare: 0.035, wells: [1.35, -1.35], wellR: Float(wellR)))
        var parts = [loft.node, Parts.panelLines(loft, seams: [0.62, -0.55], from: 0.3, to: 1.0, filler: CGPoint(x: -1.72, y: 0.8))]
        parts += Parts.greenhouse(m, rear0: CGPoint(x: -1.6, y: 0.97), rear1: CGPoint(x: -0.55, y: 1.46),
                                  front1: CGPoint(x: 0.05, y: 1.46), front0: CGPoint(x: 0.68, y: 0.97),
                                  width: 1.42, pillars: [-0.2])
        for z: Float in [0.6, 0.41, -0.41, -0.6] { parts += Parts.headlamp(m, x: 2.185, y: 0.6, z: z, r: 0.075) }
        parts += Parts.grille(m, x: 2.18, y: 0.6, h: 0.17, w: 0.6, slats: 3)
        parts.append(capsuleNode(m.chrome, r: 0.06, h: 1.78, axis: .z, at: V(2.2, 0.40, 0)))
        parts.append(capsuleNode(m.chrome, r: 0.06, h: 1.78, axis: .z, at: V(-2.2, 0.42, 0)))
        for s: Float in [1, -1] { parts += Parts.tailLamp(m, x: -2.19, y: 0.76, z: s * 0.48, h: 0.11, w: 0.5) }
        parts += Parts.plate(m, x: -2.2, y: 0.62, facing: -1)
        parts += Parts.plate(m, x: 2.225, y: 0.29, facing: 1)
        parts += Parts.exhaust(m, x: -2.2, y: 0.25, zs: [0.5, -0.5])
        parts += Parts.handles(m, loft, at: [CGPoint(x: -0.42, y: 0.86)])
        parts += Parts.mirrors(m, x: 0.6, y: 1.02, z: 0.78)
        parts += Parts.flankMarkers(m, loft, front: 1.98, rear: -1.98, y: 0.62)
        for s: Float in [1, -1] { parts.append(boxNode(m.chrome, 1.6, 0.025, 0.02, r: 0.01, at: V(0, 0.46, s * (loft.sideZ(0, 0.46) + 0.004)))) }
        return BodyBuild(node: group("body", parts), panel: path, panelZ: Float(halfW), panelInset: 0.11,
                         stripes: [[CGPoint(x: 0.66, y: 0.98), CGPoint(x: 1.2, y: 0.975), CGPoint(x: 1.6, y: 0.955), CGPoint(x: 1.98, y: 0.885)],
                                   [CGPoint(x: -0.55, y: 1.495), CGPoint(x: 0.05, y: 1.495)],
                                   [CGPoint(x: -2.0, y: 0.968), CGPoint(x: -1.62, y: 0.975)]], loft: loft)
    }

    static let sports = BodyStyle(
        id: "sports", wheelRadius: 0.37, wheelbase: 2.65, track: 1.48, wheelWidth: 0.44,
        seat: V(-0.3, 0.48, 0.28), driverScale: 0.78,
        hood: Anchor(1.2, 0.9, w: 0.8), nose: Anchor(2.25, 0.32, w: 1.6), roof: Anchor(-0.3, 1.3, w: 1.2),
        deck: Anchor(-1.85, 0.91, w: 1.6), tail: Anchor(-2.22, 0.3, w: 1.4)
    ) { m, R in
        let halfW: CGFloat = 0.92
        let wellR = CGFloat(min(R + 0.07, 0.48))
        let path = sideOutline(front: 2.18, rear: -2.15, bottom: 0.3, wells: [1.325, -1.325], wellY: 0.37, wellR: wellR) { p in
            p.l(-2.2, 0.36); p.l(-2.22, 0.78); p.q(-2.05, 0.9, -2.21, 0.88); p.l(0.6, 0.92)
            p.q(1.8, 0.86, 1.25, 0.94); p.q(2.25, 0.42, 2.15, 0.76); p.l(2.24, 0.36); p.l(2.19, 0.3)
        }
        let loft = Parts.shell(m, path, Loft.Spec(halfW: Float(halfW), shoulder: 0.6, topExp: 2.6, lowExp: 3.5,
                                                  cornerF: 0.32, cornerR: 0.25, flare: 0.045, wells: [1.325, -1.325], wellR: Float(wellR)))
        var parts = [loft.node, Parts.panelLines(loft, seams: [0.75, -0.62], from: 0.28, to: 0.95)]
        parts += Parts.greenhouse(m, rear0: CGPoint(x: -1.35, y: 0.91), rear1: CGPoint(x: -0.55, y: 1.26),
                                  front1: CGPoint(x: -0.05, y: 1.27), front0: CGPoint(x: 0.85, y: 0.90), width: 1.36, tumble: 0.45)
        for s: Float in [1, -1] {
            parts.append(Parts.rectLamp(m, x: 2.0, y: loft.topY(2.0, 0.52) - 0.005, z: s * 0.52, h: 0.14, w: 0.46, tilt: 0.95))
            parts.append(boxNode(m.grille, 0.04, 0.13, 0.34, r: 0.04, at: V(2.21, 0.4, s * 0.55)))
            parts.append(boxNode(m.amber, 0.03, 0.04, 0.2, r: 0.015, at: V(2.215, 0.5, s * 0.6)))
        }
        parts.append(boxNode(m.grille, 0.05, 0.13, 0.74, r: 0.04, at: V(2.22, 0.33, 0)))
        parts.append(boxNode(m.chrome, 0.06, 0.015, 0.7, at: V(2.235, 0.33, 0)))
        parts += Parts.tailLamp(m, x: -2.215, y: 0.76, z: 0, h: 0.07, w: 1.36)
        parts.append(boxNode(m.grille, 0.14, 0.12, 1.4, r: 0.03, at: V(-2.17, 0.25, 0)))
        parts += Parts.exhaust(m, x: -2.24, y: 0.34, zs: [0.12, -0.12, 0.27, -0.27], r: 0.045)
        parts += Parts.plate(m, x: -2.22, y: 0.52, facing: -1)
        parts += Parts.handles(m, loft, at: [CGPoint(x: -0.45, y: 0.78)])
        parts += Parts.mirrors(m, x: 0.72, y: 0.97, z: 0.74)
        return BodyBuild(node: group("body", parts), panel: path, panelZ: Float(halfW), panelInset: 0.12,
                         stripes: [[CGPoint(x: 0.9, y: 0.925), CGPoint(x: 1.4, y: 0.915), CGPoint(x: 1.8, y: 0.865), CGPoint(x: 2.09, y: 0.705)],
                                   [CGPoint(x: -0.55, y: 1.3), CGPoint(x: -0.05, y: 1.31)],
                                   [CGPoint(x: -2.05, y: 0.905), CGPoint(x: -1.38, y: 0.91)]], loft: loft)
    }

    static let formula = BodyStyle(
        id: "formula", wheelRadius: 0.40, wheelbase: 2.9, track: 1.72, wheelWidth: 0.46,
        seat: V(0.0, 0.3, 0), driverScale: 0.85,
        hood: Anchor(-1.25, 0.86, w: 0.5), nose: Anchor(2.72, 0.22, w: 1.0), roof: Anchor(-0.62, 1.1, w: 0.4),
        deck: Anchor(-1.95, 1.12, w: 1.3), tail: Anchor(-2.0, 0.32, w: 0.6)
    ) { m, R in
        let tub = sideOutline(front: 2.6, rear: -1.95, bottom: 0.12, wells: [], wellY: 0, wellR: 0) { p in
            p.l(-2.0, 0.5); p.q(-1.65, 0.78, -1.98, 0.74); p.l(-0.75, 1.02); p.q(-0.5, 1.08, -0.65, 1.1)
            p.l(-0.46, 0.74); p.l(0.5, 0.70); p.l(0.75, 0.72); p.q(2.55, 0.36, 1.6, 0.62)
            p.q(2.68, 0.2, 2.7, 0.3); p.l(2.6, 0.12)
        }
        let pod = UIBezierPath()
        pod.move(to: CGPoint(x: 0.55, y: 0.18)); pod.l(0.55, 0.52); pod.q(0.3, 0.62, 0.5, 0.62)
        pod.l(-1.0, 0.62); pod.q(-1.45, 0.4, -1.3, 0.6); pod.l(-1.45, 0.18); pod.close()
        var parts = [extrude(tub, depth: 0.66, chamfer: 0.12, m.paint),
                     extrude(pod, depth: 1.24, chamfer: 0.1, m.paint)]
        for s: Float in [1, -1] {
            parts.append(boxNode(m.grille, 0.03, 0.28, 0.2, r: 0.04, at: V(0.565, 0.4, s * 0.45)))
            // suspension arms to each wheel
            for x: Float in [1.45, -1.45] {
                parts.append(rod(m.trim, V(x + 0.18, 0.32, s * 0.3), V(x, 0.36, s * 0.7), r: 0.025))
                parts.append(rod(m.trim, V(x - 0.18, 0.48, s * 0.3), V(x, 0.46, s * 0.7), r: 0.025))
            }
        }
        // front wing, rear wing
        parts.append(Catalog.airfoil(m.paint, chord: 0.5, thickness: 0.07, span: 2.0, at: V(2.45, 0.16, 0)))
        parts.append(Catalog.airfoil(m.trim, chord: 0.3, thickness: 0.05, span: 1.9, at: V(2.25, 0.26, 0)))
        parts.append(Catalog.airfoil(m.paint, chord: 0.55, thickness: 0.1, span: 1.3, at: V(-1.95, 1.05, 0)))
        parts.append(Catalog.airfoil(m.trim, chord: 0.35, thickness: 0.06, span: 1.3, at: V(-2.05, 0.9, 0)))
        for s: Float in [1, -1] {
            parts.append(boxNode(m.trim, 0.55, 0.22, 0.03, r: 0.01, at: V(2.45, 0.22, s * 1.0)))
            parts.append(boxNode(m.trim, 0.62, 0.42, 0.03, r: 0.01, at: V(-1.98, 0.95, s * 0.66)))
        }
        parts.append(boxNode(m.trim, 0.1, 0.42, 0.06, r: 0.02, at: V(-1.9, 0.75, 0)))
        parts.append(boxNode(m.taillight, 0.03, 0.08, 0.12, r: 0.01, at: V(-2.02, 0.42, 0)))
        // halo over the cockpit
        let halo = SCNNode(geometry: SCNTorus(ringRadius: 0.32, pipeRadius: 0.03))
        halo.geometry?.materials = [m.trim]
        halo.position = V(0.05, 0.98, 0)
        halo.scale = V(1.2, 1, 0.9)
        parts.append(halo)
        parts.append(rod(m.trim, V(0.43, 0.98, 0), V(0.62, 0.72, 0), r: 0.03))
        return BodyBuild(node: group("body", parts), panel: pod, panelZ: 0.62, panelInset: 0.1, stripes: [])
    }

    static let pickup = BodyStyle(
        id: "pickup", wheelRadius: 0.44, wheelbase: 3.0, track: 1.46, wheelWidth: 0.44,
        seat: V(-0.05, 0.98, 0.3), driverScale: 0.9,
        hood: Anchor(1.55, 1.2, w: 1.0), nose: Anchor(2.55, 0.62, w: 1.8), roof: Anchor(-0.27, 1.9, w: 1.4),
        deck: Anchor(-2.2, 1.24, w: 1.7), tail: Anchor(-2.4, 0.45, w: 1.6)
    ) { m, R in
        let halfW: CGFloat = 0.93
        let wellR = CGFloat(min(R + 0.08, 0.7))
        let path = sideOutline(front: 2.42, rear: -2.35, bottom: 0.47, wells: [1.5, -1.5], wellY: 0.44, wellR: wellR) { p in
            p.l(-2.38, 0.5); p.l(-2.38, 1.2); p.l(-2.33, 1.22); p.l(0.75, 1.22)
            p.q(2.35, 1.12, 1.7, 1.22); p.q(2.5, 0.92, 2.48, 1.08); p.l(2.5, 0.52); p.l(2.43, 0.47)
        }
        let loft = Parts.shell(m, path, Loft.Spec(halfW: Float(halfW), shoulder: 1.0, topExp: 5, lowExp: 6,
                                                  cornerF: 0.15, cornerR: 0.08, flare: 0.02, wells: [1.5, -1.5], wellR: Float(wellR)))
        var parts = [loft.node, Parts.panelLines(loft, seams: [0.8, -0.8, -0.84], from: 0.45, to: 1.3)]
        parts += Parts.greenhouse(m, rear0: CGPoint(x: -0.82, y: 1.21), rear1: CGPoint(x: -0.76, y: 1.86),
                                  front1: CGPoint(x: 0.22, y: 1.86), front0: CGPoint(x: 0.82, y: 1.21),
                                  width: 1.62, pillars: [-0.28])
        // bed cover and rails
        parts.append(boxNode(m.plastic, 1.42, 0.02, 1.5, r: 0.01, at: V(-1.58, loft.topY(-1.58, 0) - 0.004, 0)))
        for s: Float in [1, -1] { parts.append(boxNode(m.trim, 1.5, 0.035, 0.07, r: 0.015, at: V(-1.58, loft.topY(-1.58, 0.8) + 0.012, s * 0.8))) }
        parts += Parts.grille(m, x: 2.49, y: 0.86, h: 0.38, w: 0.88, slats: 4)
        for s: Float in [1, -1] {
            parts.append(Parts.rectLamp(m, x: 2.47, y: 0.92, z: s * 0.62, h: 0.18, w: 0.28))
            parts += Parts.tailLamp(m, x: -2.385, y: 0.95, z: s * 0.76, h: 0.35, w: 0.14)
            parts.append(boxNode(m.trim, 1.25, 0.05, 0.22, r: 0.02, at: V(0.0, 0.42, s * 0.98)))
        }
        parts.append(boxNode(m.chrome, 0.18, 0.2, 1.9, r: 0.08, at: V(2.52, 0.5, 0)))
        parts.append(boxNode(m.chrome, 0.16, 0.18, 1.88, r: 0.07, at: V(-2.4, 0.5, 0)))
        parts.append(capsuleNode(m.chrome, r: 0.02, h: 0.2, axis: .z, at: V(-2.39, 1.12, 0)))
        parts += Parts.plate(m, x: -2.4, y: 0.72, facing: -1)
        parts += Parts.handles(m, loft, at: [CGPoint(x: -0.62, y: 1.1)])
        parts += Parts.mirrors(m, x: 0.78, y: 1.3, z: 0.87)
        parts += Parts.exhaust(m, x: -2.42, y: 0.4, zs: [-0.6])
        parts += Parts.flankMarkers(m, loft, front: 2.25, rear: -2.2, y: 0.95)
        return BodyBuild(node: group("body", parts), panel: path, panelZ: Float(halfW), panelInset: 0.12,
                         stripes: [[CGPoint(x: 0.8, y: 1.225), CGPoint(x: 1.625, y: 1.2), CGPoint(x: 2.3, y: 1.13)],
                                   [CGPoint(x: -0.76, y: 1.895), CGPoint(x: 0.22, y: 1.895)]], loft: loft)
    }

    static let offroad = BodyStyle(
        id: "offroad", wheelRadius: 0.46, wheelbase: 2.55, track: 1.42, wheelWidth: 0.46,
        seat: V(0.0, 1.03, 0.32), driverScale: 0.92,
        hood: Anchor(1.35, 1.28, w: 1.1), nose: Anchor(2.15, 0.6, w: 1.9), roof: Anchor(-0.77, 1.98, w: 1.45),
        deck: Anchor(-1.85, 1.98, w: 1.5), tail: Anchor(-2.12, 0.55, w: 1.6)
    ) { m, R in
        let halfW: CGFloat = 0.9
        let wellR = CGFloat(min(R + 0.08, 0.74))
        let path = sideOutline(front: 2.05, rear: -2.05, bottom: 0.5, wells: [1.275, -1.275], wellY: 0.46, wellR: wellR) { p in
            p.l(-2.08, 1.26); p.l(-2.04, 1.29); p.l(0.7, 1.29); p.l(1.98, 1.25)
            p.q(2.08, 1.15, 2.07, 1.25); p.l(2.09, 0.55); p.l(2.05, 0.5)
        }
        let loft = Parts.shell(m, path, Loft.Spec(halfW: Float(halfW), shoulder: 1.0, topExp: 7, lowExp: 7,
                                                  cornerF: 0.1, cornerR: 0.1, wells: [1.275, -1.275], wellR: Float(wellR)))
        var parts = [loft.node, Parts.panelLines(loft, seams: [0.78, -0.35, -1.25], from: 0.55, to: 1.32)]
        parts += Parts.greenhouse(m, rear0: CGPoint(x: -2.0, y: 1.28), rear1: CGPoint(x: -1.96, y: 1.94),
                                  front1: CGPoint(x: 0.42, y: 1.94), front0: CGPoint(x: 0.78, y: 1.28),
                                  width: 1.64, pillars: [-0.35, -1.25])
        // black fender flares round each wheel
        for x in [CGFloat(1.275), -1.275] {
            let dy = 0.5 - 0.46
            let a0 = asin(dy / wellR)
            let arc = UIBezierPath(arcCenter: CGPoint(x: x, y: 0.46), radius: wellR + 0.13, startAngle: a0, endAngle: .pi - a0, clockwise: true)
            arc.addArc(withCenter: CGPoint(x: x, y: 0.46), radius: wellR, startAngle: .pi - a0, endAngle: a0, clockwise: false)
            arc.close()
            for s: Float in [1, -1] {
                let f = extrude(arc, depth: 0.14, chamfer: 0.04, m.plastic)
                f.position.z = s * Float(halfW)
                parts.append(f)
            }
        }
        for s: Float in [1, -1] {
            parts += Parts.headlamp(m, x: 2.08, y: 1.0, z: s * 0.62, r: 0.13)
            parts += Parts.tailLamp(m, x: -2.085, y: 1.05, z: s * 0.74, h: 0.16, w: 0.16, rings: true)
            parts.append(rod(m.trim, V(-0.8, 0.5, s * 1.0), V(0.75, 0.5, s * 1.0), r: 0.045))
        }
        for i in 0..<7 {
            parts.append(boxNode(m.grille, 0.03, 0.34, 0.07, r: 0.02, at: V(2.09, 0.98, (Float(i) - 3) * 0.12)))
        }
        parts.append(boxNode(m.trim, 0.2, 0.18, 1.92, r: 0.03, at: V(2.13, 0.56, 0)))
        parts.append(boxNode(m.trim, 0.18, 0.16, 1.85, r: 0.03, at: V(-2.1, 0.56, 0)))
        for s: Float in [1, -1] { parts.append(torusNode(m.taillight, ring: 0.05, pipe: 0.018, axis: .z, at: V(2.25, 0.56, s * 0.55))) }
        // spare wheel on the back door
        parts.append(torusNode(m.rubber, ring: 0.27, pipe: 0.13, axis: .x, at: V(-2.2, 1.02, 0)))
        parts.append(cylNode(m.alloy, r: 0.2, h: 0.14, axis: .x, at: V(-2.2, 1.02, 0)))
        // snorkel up the right-hand pillar
        parts.append(rod(m.trim, V(1.3, 0.95, -0.94), V(0.82, 1.3, -0.94), r: 0.05))
        parts.append(rod(m.trim, V(0.82, 1.3, -0.94), V(0.5, 1.98, -0.87), r: 0.05))
        parts += Parts.plate(m, x: -2.1, y: 0.72, facing: -1)
        parts += Parts.handles(m, loft, at: [CGPoint(x: 0.15, y: 1.16), CGPoint(x: -0.95, y: 1.16)])
        parts += Parts.mirrors(m, x: 0.76, y: 1.36, z: 0.89)
        return BodyBuild(node: group("body", parts), panel: path, panelZ: Float(halfW), panelInset: 0.1,
                         stripes: [[CGPoint(x: 0.8, y: 1.29), CGPoint(x: 1.98, y: 1.255)],
                                   [CGPoint(x: -1.96, y: 1.975), CGPoint(x: 0.42, y: 1.975)]], loft: loft)
    }

    static let monster = BodyStyle(
        id: "monster", wheelRadius: 0.85, wheelbase: 2.4, track: 2.12, wheelWidth: 0.72,
        seat: V(-0.2, 1.72, 0.3), driverScale: 0.85,
        hood: Anchor(1.4, 1.96, w: 1.0), nose: Anchor(2.35, 1.4, w: 1.8), roof: Anchor(-0.42, 2.58, w: 1.3),
        deck: Anchor(-2.0, 1.99, w: 1.6), tail: Anchor(-2.3, 1.35, w: 1.6)
    ) { m, R in
        let halfW: CGFloat = 0.86
        let wellR = CGFloat(min(R + 0.1, 1.07))
        let path = sideOutline(front: 2.25, rear: -2.25, bottom: 1.25, wells: [1.2, -1.2], wellY: 0.85, wellR: wellR) { p in
            p.l(-2.28, 1.95); p.l(-2.22, 1.98); p.l(0.55, 1.98)
            p.q(2.15, 1.9, 1.6, 1.98); p.q(2.3, 1.7, 2.28, 1.85); p.l(2.3, 1.3); p.l(2.25, 1.25)
        }
        let loft = Parts.shell(m, path, Loft.Spec(halfW: Float(halfW), shoulder: 1.72, topExp: 3.2, lowExp: 4,
                                                  cornerF: 0.16, cornerR: 0.16, wells: [1.2, -1.2], wellR: Float(wellR)))
        var parts = [loft.node, Parts.panelLines(loft, seams: [0.58, -0.62], from: 1.25, to: 2.0)]
        parts += Parts.greenhouse(m, rear0: CGPoint(x: -0.95, y: 1.97), rear1: CGPoint(x: -0.88, y: 2.55),
                                  front1: CGPoint(x: 0.05, y: 2.55), front0: CGPoint(x: 0.6, y: 1.97), width: 1.5)
        // chassis, axles, shocks
        for s: Float in [1, -1] { parts.append(boxNode(m.trim, 4.2, 0.18, 0.12, r: 0.03, at: V(0, 1.12, s * 0.45))) }
        let shock = SCNMaterial.pbr(UIColor(red: 0.95, green: 0.6, blue: 0.0, alpha: 1), metal: 0.6, rough: 0.3)
        for x: Float in [1.2, -1.2] {
            parts.append(cylNode(m.gunmetal, r: 0.1, h: 2.0, axis: .z, at: V(x, 0.85, 0)))
            parts.append(sphereNode(m.gunmetal, r: 0.22, at: V(x, 0.85, 0)))
            for s: Float in [1, -1] {
                let a = V(x - 0.15 * (x > 0 ? 1 : -1), 0.85, s * 0.6), b = V(x - 0.5 * (x > 0 ? 1 : -1), 1.25, s * 0.55)
                parts.append(rod(shock, a, b, r: 0.075))
                parts.append(rod(m.chrome, a, b, r: 0.04))
            }
        }
        for s: Float in [1, -1] {
            parts += Parts.headlamp(m, x: 2.28, y: 1.72, z: s * 0.6, r: 0.1)
            parts += Parts.tailLamp(m, x: -2.27, y: 1.75, z: s * 0.64, h: 0.18, w: 0.2)
        }
        parts += Parts.grille(m, x: 2.29, y: 1.58, h: 0.3, w: 0.8, slats: 3)
        parts.append(capsuleNode(m.trim, r: 0.08, h: 1.9, axis: .z, at: V(2.33, 1.32, 0)))
        parts.append(capsuleNode(m.trim, r: 0.08, h: 1.9, axis: .z, at: V(-2.3, 1.32, 0)))
        parts += Parts.handles(m, loft, at: [CGPoint(x: -0.45, y: 1.84)])
        parts += Parts.mirrors(m, x: 0.58, y: 2.05, z: 0.81)
        return BodyBuild(node: group("body", parts), panel: path, panelZ: Float(halfW), panelInset: 0.12,
                         stripes: [[CGPoint(x: 0.6, y: 1.985), CGPoint(x: 1.475, y: 1.965), CGPoint(x: 2.1, y: 1.91)],
                                   [CGPoint(x: -0.88, y: 2.585), CGPoint(x: 0.05, y: 2.585)],
                                   [CGPoint(x: -2.2, y: 1.985), CGPoint(x: -1.0, y: 1.985)]], loft: loft)
    }

    static let bus = BodyStyle(
        id: "bus", wheelRadius: 0.46, wheelbase: 3.4, track: 1.52, wheelWidth: 0.42,
        seat: V(2.15, 1.0, 0.45), driverScale: 0.95,
        hood: Anchor(-1.6, 2.15, w: 0.8), nose: Anchor(2.85, 0.6, w: 1.9), roof: Anchor(0.6, 2.15, w: 1.6),
        deck: Anchor(-2.5, 2.15, w: 1.7), tail: Anchor(-2.8, 0.5, w: 1.6)
    ) { m, R in
        let halfW: CGFloat = 0.95
        let wellR = CGFloat(min(R + 0.08, 0.76))
        let path = sideOutline(front: 2.75, rear: -2.75, bottom: 0.5, wells: [1.7, -1.7], wellY: 0.46, wellR: wellR) { p in
            p.l(-2.78, 1.28); p.l(-2.75, 1.31); p.l(2.6, 1.31)
            p.q(2.8, 1.2, 2.78, 1.3); p.l(2.8, 0.54); p.l(2.76, 0.5)
        }
        let loft = Parts.shell(m, path, Loft.Spec(halfW: Float(halfW), shoulder: 0.95, topExp: 8, lowExp: 8,
                                                  cornerF: 0.12, cornerR: 0.12, wells: [1.7, -1.7], wellR: Float(wellR)))
        var parts = [loft.node]
        parts += Parts.greenhouse(m, rear0: CGPoint(x: -2.73, y: 1.30), rear1: CGPoint(x: -2.72, y: 2.12),
                                  front1: CGPoint(x: 2.6, y: 2.12), front0: CGPoint(x: 2.78, y: 1.30),
                                  width: 1.82, pillars: [-1.95, -1.15, -0.35, 0.45, 1.25, 2.0], tumble: 0.1)
        for s: Float in [1, -1] {
            for y: Float in [1.12, 1.24] {
                parts.append(boxNode(m.trim, 5.4, 0.035, 0.02, r: 0.01, at: V(0, y, s * (loft.sideZ(0, y) + 0.004))))
            }
            parts += Parts.headlamp(m, x: 2.79, y: 0.85, z: s * 0.68, r: 0.11)
            parts += Parts.tailLamp(m, x: -2.775, y: 0.95, z: s * 0.68, h: 0.2, w: 0.2, rings: true)
            parts.append(sphereNode(m.amber, r: 0.07, at: V(2.62, 2.2, s * 0.6)))
            parts.append(sphereNode(m.taillight, r: 0.07, at: V(-2.7, 2.2, s * 0.6)))
            parts.append(rod(m.trim, V(2.7, 1.35, s * 0.85), V(2.9, 1.6, s * 1.05), r: 0.025))
            parts.append(boxNode(m.trim, 0.06, 0.3, 0.16, r: 0.03, at: V(2.92, 1.62, s * 1.08)))
        }
        parts += Parts.grille(m, x: 2.8, y: 0.8, h: 0.3, w: 0.7, slats: 3)
        parts.append(boxNode(m.trim, 0.15, 0.18, 1.95, r: 0.04, at: V(2.82, 0.5, 0)))
        parts.append(boxNode(m.trim, 0.15, 0.18, 1.95, r: 0.04, at: V(-2.8, 0.5, 0)))
        parts += Parts.plate(m, x: -2.79, y: 0.75, facing: -1)
        parts += Parts.exhaust(m, x: -2.8, y: 0.42, zs: [0.6])
        return BodyBuild(node: group("body", parts), panel: path, panelZ: Float(halfW), panelInset: 0.12,
                         stripes: [[CGPoint(x: -2.72, y: 2.155), CGPoint(x: 2.6, y: 2.155)]], loft: loft)
    }

    /// A wing with a rounded, teardrop profile (front toward +X), spanning Z.
    static func airfoil(_ mat: SCNMaterial, chord: CGFloat, thickness: CGFloat, span: CGFloat, at p: SCNVector3) -> SCNNode {
        let path = UIBezierPath()
        path.move(to: CGPoint(x: chord / 2, y: 0))
        path.addQuadCurve(to: CGPoint(x: -chord / 2, y: thickness * 0.15), controlPoint: CGPoint(x: chord * 0.2, y: thickness * 1.2))
        path.addQuadCurve(to: CGPoint(x: chord / 2, y: 0), controlPoint: CGPoint(x: 0, y: -thickness * 0.4))
        path.close()
        let n = extrude(path, depth: span, chamfer: 0.015, mat)
        n.position = p
        return n
    }
}
