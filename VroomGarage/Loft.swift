import SceneKit
import UIKit
import simd

/// A car body skinned from its side outline: every slice across the car is a rounded
/// (superellipse) section, so the sides bow out, the hood is crowned and the corners roll
/// over smoothly instead of looking like a flat cut-out with a bevelled edge.
final class Loft {
    struct Spec {
        var halfW: Float
        /// Height where the sides are widest.
        var shoulder: Float
        /// Roundness above / below the shoulder: ~2.5 is soft and curvy, 8 is nearly boxy.
        var topExp: Float = 3
        var lowExp: Float = 4
        /// Rounding of the corners seen from above.
        var cornerF: Float = 0.2
        var cornerR: Float = 0.2
        /// How far the lower body swells out around each wheel (fraction of the width).
        var flare: Float = 0
        var wells: [Float] = []
        var wellR: Float = 0.5
    }

    let spec: Spec
    let outline: UIBezierPath
    let node: SCNNode
    private let poly: [CGPoint]
    private let minX: Float, maxX: Float
    private var xs: [Float] = []
    private var grid: [[simd_float3]] = []
    private var norms: [[simd_float3]] = []
    private let N = 96

    init(_ outline: UIBezierPath, _ spec: Spec, paint: SCNMaterial, under: SCNMaterial) {
        self.spec = spec
        self.outline = outline
        poly = Loft.flatten(outline)
        minX = Float(poly.map(\.x).min() ?? 0)
        maxX = Float(poly.map(\.x).max() ?? 0)
        node = SCNNode()
        node.name = "shell"
        buildGrid()
        node.geometry = buildGeometry(paint: paint, under: under)
    }

    // MARK: Shape queries

    /// Lowest and highest point of the outline at this x.
    func span(_ x: Float) -> (lo: Float, hi: Float)? {
        var lo = Float.greatestFiniteMagnitude, hi = -Float.greatestFiniteMagnitude
        let cx = CGFloat(x)
        for k in 0..<(poly.count - 1) {
            let a = poly[k], b = poly[k + 1]
            guard (a.x - cx) * (b.x - cx) <= 0 else { continue }
            if abs(b.x - a.x) < 1e-6 {
                lo = min(lo, Float(min(a.y, b.y))); hi = max(hi, Float(max(a.y, b.y)))
            } else {
                let y = Float(a.y + (b.y - a.y) * (cx - a.x) / (b.x - a.x))
                lo = min(lo, y); hi = max(hi, y)
            }
        }
        return lo <= hi ? (lo, hi) : nil
    }

    /// Half-width at this x, with the corners rounded off in plan.
    func planW(_ x: Float) -> Float {
        var w = spec.halfW
        let f = spec.cornerF, r = spec.cornerR
        let dF = x - (maxX - f)
        if dF > 0 { w = min(w, spec.halfW - f + sqrt(max(0, f * f - dF * dF))) }
        let dR = (minX + r) - x
        if dR > 0 { w = min(w, spec.halfW - r + sqrt(max(0, r * r - dR * dR))) }
        return w
    }

    private func bump(_ x: Float) -> Float {
        guard spec.flare > 0 else { return 0 }
        var b: Float = 0
        for w in spec.wells {
            let t = (x - w) / (spec.wellR * 1.35)
            b = max(b, exp(-t * t * t * t))
        }
        return spec.flare * b
    }

    private struct Section { let yb, yt, ys, W: Float }

    private func section(_ x: Float) -> Section? {
        guard let (yb, yt) = span(x) else { return nil }
        let H = yt - yb
        let ys = min(max(spec.shoulder, yb + 0.3 * H), yt - 0.25 * H)
        return Section(yb: yb, yt: yt, ys: ys, W: planW(x))
    }

    private func point(_ s: Section, _ x: Float, _ theta: Float) -> simd_float3 {
        let c = cos(theta), sn = sin(theta)
        let up = sn >= 0
        let p = up ? spec.topExp : spec.lowExp
        let zf = (c < 0 ? -1 : 1) * pow(abs(c), 2 / p)
        let yf = (sn < 0 ? -1 : 1) * pow(abs(sn), 2 / p)
        let swell = 1 + bump(x) * (up ? (1 - yf) * (1 - yf) : 1)
        let h = up ? s.yt - s.ys : s.ys - s.yb
        return simd_float3(x, s.ys + h * yf, s.W * zf * swell)
    }

    /// How far out the side is at (x, y), for bolting things flush onto it.
    func sideZ(_ x: Float, _ y: Float) -> Float {
        guard let s = section(x) else { return spec.halfW }
        if y >= s.ys {
            let t = min(1, (y - s.ys) / max(1e-4, s.yt - s.ys))
            let zf = pow(max(0, 1 - pow(t, spec.topExp)), 1 / spec.topExp)
            return s.W * zf * (1 + bump(x) * (1 - t) * (1 - t))
        } else {
            let t = min(1, (s.ys - y) / max(1e-4, s.ys - s.yb))
            return s.W * pow(max(0, 1 - pow(t, spec.lowExp)), 1 / spec.lowExp) * (1 + bump(x))
        }
    }

    /// Height of the top surface at (x, z).
    func topY(_ x: Float, _ z: Float) -> Float {
        guard let s = section(x) else { return 0 }
        let zf = min(1, abs(z) / s.W)
        return s.ys + (s.yt - s.ys) * pow(max(0, 1 - pow(zf, spec.topExp)), 1 / spec.topExp)
    }

    // MARK: Mesh

    private func buildGrid() {
        var cand: [Float] = []
        var x = minX
        while x < maxX { cand.append(x); x += 0.035 }
        cand.append(maxX)
        cand += poly.map { Float($0.x) }
        for k in 0...14 {
            let s = sin(Float(k) / 14 * .pi / 2)
            cand.append(maxX - spec.cornerF + spec.cornerF * s)
            cand.append(minX + spec.cornerR - spec.cornerR * s)
        }
        cand = cand.filter { $0 >= minX && $0 <= maxX }.sorted()
        var picked: [Float] = []
        for c in cand where picked.last.map({ c - $0 > 0.003 }) ?? true { picked.append(c) }
        if let last = picked.last, last < maxX { picked[picked.count - 1] = maxX }

        for x in picked {
            guard let s = section(x) else { continue }
            xs.append(x)
            grid.append((0...N).map { j in point(s, x, -.pi / 2 + 2 * .pi * Float(j) / Float(N)) })
        }
        let S = grid.count
        norms = (0..<S).map { i in
            (0...N).map { j in
                let ip = min(i + 1, S - 1), im = max(i - 1, 0)
                let jp = j == N ? 1 : j + 1, jm = j == 0 ? N - 1 : j - 1
                let dX = grid[ip][j] - grid[im][j]
                let dT = grid[i][jp] - grid[i][jm]
                let n = simd_cross(dX, dT)
                let len = simd_length(n)
                if len > 1e-9 { return n / len }
                let p = grid[i][j]
                let r = simd_float3(0, p.y - (grid[i][0].y + grid[i][N / 2].y) / 2, p.z)
                return simd_length(r) > 1e-6 ? simd_normalize(r) : simd_float3(i == 0 ? -1 : 1, 0, 0)
            }
        }
    }

    private func buildGeometry(paint: SCNMaterial, under: SCNMaterial) -> SCNGeometry {
        var verts: [SCNVector3] = [], normals: [SCNVector3] = []
        for i in grid.indices {
            for j in 0...N {
                let p = grid[i][j], n = norms[i][j]
                verts.append(SCNVector3(p.x, p.y, p.z))
                normals.append(SCNVector3(n.x, n.y, n.z))
            }
        }
        let row = N + 1
        let band = Int(Float(N) * 0.085)
        var top: [UInt32] = [], bottom: [UInt32] = []
        for i in 0..<(grid.count - 1) {
            for j in 0..<N {
                let a = UInt32(i * row + j), b = UInt32((i + 1) * row + j)
                let c = b + 1, d = a + 1
                let tri = [a, b, c, a, c, d]
                if j < band || j >= N - band { bottom += tri } else { top += tri }
            }
        }
        // End caps (flat faces at the very nose and tail).
        for (i, dir) in [(grid.count - 1, Float(1)), (0, Float(-1))] {
            let ring = grid[i]
            var c = simd_float3(0, 0, 0)
            for j in 0..<N { c += ring[j] }
            c /= Float(N)
            let base = UInt32(verts.count)
            verts.append(SCNVector3(c.x, c.y, c.z)); normals.append(SCNVector3(dir, 0, 0))
            for j in 0...N {
                let p = ring[j]
                verts.append(SCNVector3(p.x, p.y, p.z)); normals.append(SCNVector3(dir, 0, 0))
            }
            for j in 0..<N {
                let p0 = base + 1 + UInt32(j), p1 = p0 + 1
                top += dir > 0 ? [base, p1, p0] : [base, p0, p1]
            }
        }
        let g = SCNGeometry(sources: [SCNGeometrySource(vertices: verts), SCNGeometrySource(normals: normals)],
                            elements: [SCNGeometryElement(indices: top, primitiveType: .triangles),
                                       SCNGeometryElement(indices: bottom, primitiveType: .triangles)])
        g.materials = [paint, under]
        return g
    }

    /// A thin skin over both flat-ish sides carrying a picture (stickers, door seams).
    /// `images` are for the +Z side and the -Z side (already mirrored); both map onto `rect` in car XY.
    func decal(_ right: UIImage, _ left: UIImage, rect: CGRect, offset: Float, order: Int, clearCoat: Bool = true) -> SCNNode {
        let root = SCNNode()
        for (side, img) in [(Float(1), right), (Float(-1), left)] {
            let js: ClosedRange<Int> = side > 0 ? 0...(N / 2) : (N / 2)...N
            var verts: [SCNVector3] = [], normals: [SCNVector3] = [], uvs: [CGPoint] = []
            var index: [[Int]] = Array(repeating: Array(repeating: -1, count: N + 1), count: grid.count)
            for i in grid.indices {
                for j in js {
                    let n = norms[i][j]
                    guard n.z * side > 0.3 else { continue }
                    let p = grid[i][j] + n * offset
                    index[i][j] = verts.count
                    verts.append(SCNVector3(p.x, p.y, p.z))
                    normals.append(SCNVector3(n.x, n.y, n.z))
                    let u = side > 0 ? (CGFloat(p.x) - rect.minX) / rect.width : (rect.maxX - CGFloat(p.x)) / rect.width
                    uvs.append(CGPoint(x: u, y: (rect.maxY - CGFloat(p.y)) / rect.height))
                }
            }
            var tris: [UInt32] = []
            for i in 0..<(grid.count - 1) {
                for j in js where j < js.upperBound {
                    let q = [index[i][j], index[i + 1][j], index[i + 1][j + 1], index[i][j + 1]]
                    guard !q.contains(-1) else { continue }
                    let u = q.map { UInt32($0) }
                    tris += [u[0], u[1], u[2], u[0], u[2], u[3]]
                }
            }
            guard !tris.isEmpty else { continue }
            let g = SCNGeometry(sources: [SCNGeometrySource(vertices: verts), SCNGeometrySource(normals: normals),
                                          SCNGeometrySource(textureCoordinates: uvs)],
                                elements: [SCNGeometryElement(indices: tris, primitiveType: .triangles)])
            let mat = SCNMaterial.pbr(.white, rough: 0.3, clearCoat: clearCoat)
            mat.diffuse.contents = img
            mat.transparencyMode = .aOne
            mat.blendMode = .alpha
            mat.writesToDepthBuffer = false
            g.materials = [mat]
            let n = SCNNode(geometry: g)
            n.renderingOrder = order
            root.addChildNode(n)
        }
        return root
    }

    // MARK: Helpers

    static func flatten(_ path: UIBezierPath, steps: Int = 24) -> [CGPoint] {
        var pts: [CGPoint] = []
        var cur = CGPoint.zero, start = CGPoint.zero
        path.cgPath.applyWithBlock { e in
            let el = e.pointee
            switch el.type {
            case .moveToPoint:
                cur = el.points[0]; start = cur; pts.append(cur)
            case .addLineToPoint:
                cur = el.points[0]; pts.append(cur)
            case .addQuadCurveToPoint:
                let c = el.points[0], p = el.points[1]
                for k in 1...steps {
                    let t = CGFloat(k) / CGFloat(steps), u = 1 - t
                    pts.append(CGPoint(x: u * u * cur.x + 2 * u * t * c.x + t * t * p.x,
                                       y: u * u * cur.y + 2 * u * t * c.y + t * t * p.y))
                }
                cur = p
            case .addCurveToPoint:
                let c1 = el.points[0], c2 = el.points[1], p = el.points[2]
                for k in 1...steps {
                    let t = CGFloat(k) / CGFloat(steps), u = 1 - t
                    let a = u * u * u, b = 3 * u * u * t, c = 3 * u * t * t, d = t * t * t
                    pts.append(CGPoint(x: a * cur.x + b * c1.x + c * c2.x + d * p.x,
                                       y: a * cur.y + b * c1.y + c * c2.y + d * p.y))
                }
                cur = p
            case .closeSubpath:
                pts.append(start); cur = start
            @unknown default:
                break
            }
        }
        return pts
    }
}

/// Lean a part's sides inward as it rises (the way a car's cabin narrows toward the roof).
/// Works on any geometry whose vertices and normals are plain float triples.
func tumblehome(_ node: SCNNode, from y0: Float, rate k: Float) {
    guard let g = node.geometry,
          let vs = g.sources(for: .vertex).first else { return }
    let ns = g.sources(for: .normal).first
    let pz = node.position.z, py = node.position.y
    func read(_ s: SCNGeometrySource) -> [simd_float3] {
        guard s.usesFloatComponents, s.bytesPerComponent == 4, s.componentsPerVector >= 3 else { return [] }
        return s.data.withUnsafeBytes { raw in
            (0..<s.vectorCount).map { i in
                let o = s.dataOffset + i * s.dataStride
                return simd_float3(raw.load(fromByteOffset: o, as: Float.self),
                                   raw.load(fromByteOffset: o + 4, as: Float.self),
                                   raw.load(fromByteOffset: o + 8, as: Float.self))
            }
        }
    }
    let P = read(vs)
    guard !P.isEmpty else { return }
    let Nn = ns.map(read) ?? []
    var outP: [SCNVector3] = [], outN: [SCNVector3] = []
    for (i, p) in P.enumerated() {
        let y = p.y + py, z = p.z + pz
        let s = max(0.5, 1 - k * max(0, y - y0))
        let ds: Float = y > y0 ? -k : 0
        outP.append(SCNVector3(p.x, p.y, z * s - pz))
        if i < Nn.count {
            let n = Nn[i]
            let m = simd_normalize(simd_float3(n.x, n.y - z * ds / s * n.z, n.z / s))
            outN.append(SCNVector3(m.x, m.y, m.z))
        }
    }
    var sources = [SCNGeometrySource(vertices: outP)]
    if !outN.isEmpty { sources.append(SCNGeometrySource(normals: outN)) }
    sources += g.sources.filter { $0.semantic != .vertex && $0.semantic != .normal }
    let ng = SCNGeometry(sources: sources, elements: g.elements)
    ng.materials = g.materials
    node.geometry = ng
}
