import SceneKit
import UIKit

/// Side decals and top racing stripes. Decal art is drawn to fit the body's side outline,
/// so it never hangs over a wheel well or past a rounded edge.
enum Stickers {
    static let numbers = ["muscle": "1", "sports": "7", "formula": "5", "pickup": "4", "offroad": "9", "monster": "8", "bus": "3"]

    static func make(_ id: String, bodyID: String, shell: BodyBuild, m: CarMaterials) -> SCNNode? {
        guard id != "none" else { return nil }
        let root = SCNNode()
        root.name = "sticker"
        if id == "stripes" {
            for run in shell.stripes { stripeRun(run, m: m).forEach { root.addChildNode($0) } }
        }
        let b = shell.panel.bounds
        for side: Float in [1, -1] {
            guard let img = art(id, shell: shell, paint: m.current, number: numbers[bodyID] ?? "1", mirror: side < 0) else { continue }
            let plane = SCNPlane(width: b.width, height: b.height)
            let mat = SCNMaterial.pbr(.white, rough: 0.3, clearCoat: true)
            mat.diffuse.contents = img
            mat.transparencyMode = .aOne
            mat.blendMode = .alpha
            mat.writesToDepthBuffer = false
            plane.materials = [mat]
            let n = SCNNode(geometry: plane)
            n.position = V(Float(b.midX), Float(b.midY), side * (shell.panelZ + 0.004))
            if side < 0 { n.eulerAngles.y = .pi }
            n.renderingOrder = 5
            root.addChildNode(n)
        }
        return root
    }

    private static func stripeRun(_ pts: [CGPoint], m: CarMaterials) -> [SCNNode] {
        var out: [SCNNode] = []
        guard pts.count > 1 else { return out }
        for i in 0..<(pts.count - 1) {
            let a = pts[i], b = pts[i + 1]
            let dx = b.x - a.x, dy = b.y - a.y
            let len = (dx * dx + dy * dy).squareRoot()
            let ang = Float(atan2(dy, dx))
            for z: Float in [0.13, -0.13] {
                let s = boxNode(m.stripe, len + 0.01, 0.01, 0.17, at: V(Float(a.x + b.x) / 2, Float(a.y + b.y) / 2 + 0.004, z))
                s.eulerAngles.z = ang
                out.append(s)
            }
        }
        return out
    }

    // MARK: Art

    private static func art(_ id: String, shell: BodyBuild, paint: PaintStyle, number: String, mirror: Bool) -> UIImage? {
        let b = shell.panel.bounds
        let scale: CGFloat = 220
        let size = CGSize(width: b.width * scale, height: b.height * scale)
        let ink = paint.isLight ? UIColor(white: 0.08, alpha: 1) : UIColor.white
        let L = b.width, H = b.height
        let midY = b.minY + H * 0.48

        return UIGraphicsImageRenderer(size: size).image { ctx in
            let c = ctx.cgContext
            c.saveGState()
            if mirror { c.translateBy(x: size.width, y: 0); c.scaleBy(x: -1, y: 1) }
            c.translateBy(x: 0, y: size.height)
            c.scaleBy(x: scale, y: -scale)
            c.translateBy(x: -b.minX, y: -b.minY)
            c.addPath(shell.panel.cgPath)
            c.clip()

            switch id {
            case "flames":
                drawFlames(c, front: b.maxX, length: L, yLo: b.minY + H * 0.22, yHi: b.minY + H * 0.82)
            case "lightning":
                let bolt = UIBezierPath()
                let x0 = b.maxX - 0.15, x1 = b.minX + 0.2
                let t = H * 0.14
                bolt.move(to: CGPoint(x: x0, y: midY + t))
                bolt.l(x0 - L * 0.32, midY + t * 1.6)
                bolt.l(x0 - L * 0.36, midY + t * 0.2)
                bolt.l(x0 - L * 0.62, midY + t * 1.1)
                bolt.l(x0 - L * 0.66, midY - t * 0.2)
                bolt.l(x1, midY - t * 0.6)
                bolt.l(x0 - L * 0.62, midY - t * 1.4)
                bolt.l(x0 - L * 0.58, midY - t * 0.1)
                bolt.l(x0 - L * 0.32, midY - t * 1.1)
                bolt.l(x0 - L * 0.28, midY + t * 0.3)
                bolt.close()
                c.addPath(bolt.cgPath)
                c.setFillColor(UIColor(red: 1, green: 0.85, blue: 0.05, alpha: 1).cgColor)
                c.setStrokeColor(UIColor(white: 0.05, alpha: 1).cgColor)
                c.setLineWidth(0.025)
                c.setLineJoin(.round)
                c.drawPath(using: .fillStroke)
            case "stripes":
                c.setFillColor(ink.cgColor)
                c.fill(CGRect(x: b.minX, y: b.minY + H * 0.3, width: L, height: H * 0.09))
                c.fill(CGRect(x: b.minX, y: b.minY + H * 0.44, width: L, height: H * 0.04))
            case "checker":
                let sq = H * 0.11
                let y0 = b.minY + H * 0.3
                var x = b.minX
                var i = 0
                while x < b.maxX {
                    for row in 0..<2 {
                        let dark = (i + row) % 2 == 0
                        c.setFillColor((dark ? UIColor(white: 0.05, alpha: 1) : UIColor.white).cgColor)
                        c.fill(CGRect(x: x, y: y0 + CGFloat(row) * sq, width: sq, height: sq))
                    }
                    x += sq
                    i += 1
                }
            default:
                break
            }

            // Wipe a band along the outline where the rounded edge curves away.
            c.setBlendMode(.clear)
            c.addPath(shell.panel.cgPath)
            c.setLineWidth(shell.panelInset * 2 + 0.03)
            c.setLineJoin(.round)
            c.strokePath()
            c.restoreGState()

            if id == "number" {
                // Drawn in image space so the digits never come out backwards.
                let cx = size.width / 2
                let cy = (b.maxY - midY) * scale
                let r = min(H * 0.33, 0.32) * scale
                let disc = CGRect(x: cx - r, y: cy - r, width: r * 2, height: r * 2)
                c.setFillColor(UIColor.white.cgColor)
                c.fillEllipse(in: disc)
                c.setStrokeColor(UIColor(white: 0.05, alpha: 1).cgColor)
                c.setLineWidth(r * 0.1)
                c.strokeEllipse(in: disc.insetBy(dx: r * 0.05, dy: r * 0.05))
                let font = UIFont.systemFont(ofSize: r * 1.4, weight: .black)
                let attrs: [NSAttributedString.Key: Any] = [.font: font, .foregroundColor: UIColor(white: 0.05, alpha: 1)]
                let str = NSAttributedString(string: number, attributes: attrs)
                let ts = str.size()
                str.draw(at: CGPoint(x: cx - ts.width / 2, y: cy - ts.height / 2))
            }
        }
    }

    /// Classic hot-rod flames licking back from the nose.
    private static func drawFlames(_ c: CGContext, front: CGFloat, length L: CGFloat, yLo: CGFloat, yHi: CGFloat) {
        let tongues = 5
        let H = yHi - yLo
        let p = UIBezierPath()
        p.move(to: CGPoint(x: front + 0.2, y: yHi))
        for i in 0..<tongues {
            let t = CGFloat(i) / CGFloat(tongues - 1)
            let yTip = yHi - H * (0.08 + 0.84 * t)
            let reach = L * (0.42 + 0.22 * sin(CGFloat(i) * 2.1 + 0.5))
            let tip = CGPoint(x: front - reach, y: yTip + H * 0.05)
            let valley = CGPoint(x: front - L * 0.2, y: yHi - H * (0.08 + 0.84 * (t + 0.5 / CGFloat(tongues - 1))))
            p.addQuadCurve(to: tip, controlPoint: CGPoint(x: front - reach * 0.55, y: yTip + H * 0.2))
            if i < tongues - 1 {
                p.addQuadCurve(to: valley, controlPoint: CGPoint(x: front - reach * 0.6, y: yTip - H * 0.02))
            } else {
                p.addQuadCurve(to: CGPoint(x: front + 0.2, y: yLo), controlPoint: CGPoint(x: front - reach * 0.5, y: yLo))
            }
        }
        p.close()
        c.saveGState()
        c.addPath(p.cgPath)
        c.clip()
        let colors = [UIColor(red: 1, green: 0.95, blue: 0.3, alpha: 1).cgColor,
                      UIColor(red: 1, green: 0.55, blue: 0.0, alpha: 1).cgColor,
                      UIColor(red: 0.85, green: 0.05, blue: 0.0, alpha: 1).cgColor] as CFArray
        let grad = CGGradient(colorsSpace: CGColorSpaceCreateDeviceRGB(), colors: colors, locations: [0, 0.45, 1])!
        c.drawLinearGradient(grad, start: CGPoint(x: front, y: 0), end: CGPoint(x: front - L * 0.66, y: 0), options: [.drawsAfterEndLocation])
        c.restoreGState()
        c.addPath(p.cgPath)
        c.setStrokeColor(UIColor(red: 0.5, green: 0.0, blue: 0.0, alpha: 1).cgColor)
        c.setLineWidth(0.02)
        c.strokePath()
    }
}
