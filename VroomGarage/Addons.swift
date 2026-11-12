import SceneKit
import UIKit

// Bolt-on parts. Each is built at its anchor's origin on the body:
// engine parts sit on the hood, front parts face +X from the nose,
// roof parts sit on the roof, back parts sit on the rear deck.

extension Catalog {
    // MARK: Engine (on the hood)

    static let engineParts: [AddonStyle] = [
        AddonStyle(id: "none", build: nil),
        AddonStyle(id: "blower") { m, _ in
            var p: [SCNNode] = [boxNode(m.gunmetal, 0.62, 0.08, 0.5, r: 0.02, at: V(0, 0.04, 0))]
            p.append(boxNode(m.chrome, 0.58, 0.3, 0.4, r: 0.08, at: V(0, 0.23, 0)))
            for i in 0..<7 {
                p.append(boxNode(m.chrome, 0.025, 0.32, 0.44, r: 0.01, at: V(-0.24 + Float(i) * 0.08, 0.23, 0)))
            }
            p.append(cylNode(m.gunmetal, r: 0.11, h: 0.06, axis: .x, at: V(0.32, 0.2, 0.08)))
            p.append(cylNode(m.gunmetal, r: 0.07, h: 0.06, axis: .x, at: V(0.32, 0.08, -0.12)))
            p.append(boxNode(m.trim, 0.02, 0.26, 0.06, at: V(0.34, 0.14, -0.02)))
            // air scoop with butterfly flaps
            p.append(boxNode(m.trim, 0.4, 0.2, 0.34, r: 0.04, at: V(0.0, 0.48, 0)))
            p.append(boxNode(m.grille, 0.04, 0.16, 0.3, at: V(0.2, 0.48, 0)))
            for i in 0..<3 { p.append(boxNode(m.chrome, 0.03, 0.02, 0.28, at: V(0.21, 0.42 + Float(i) * 0.06, 0))) }
            return group("addon", p)
        },
        AddonStyle(id: "scoop") { m, _ in
            let path = UIBezierPath()
            path.move(to: CGPoint(x: -0.5, y: -0.02)); path.l(0.38, -0.02); path.l(0.38, 0.17)
            path.q(-0.5, 0.03, 0.0, 0.17); path.close()
            let s = extrude(path, depth: 0.5, chamfer: 0.04, m.paint)
            return group("addon", [s, boxNode(m.grille, 0.03, 0.12, 0.4, r: 0.02, at: V(0.39, 0.08, 0))])
        },
        AddonStyle(id: "stacks") { m, _ in
            var p: [SCNNode] = [boxNode(m.gunmetal, 0.62, 0.1, 0.44, r: 0.03, at: V(0, 0.05, 0))]
            for x: Float in [-0.22, -0.075, 0.075, 0.22] {
                for z: Float in [0.11, -0.11] {
                    p.append(coneNode(m.chrome, top: 0.065, bottom: 0.04, h: 0.24, at: V(x, 0.22, z)))
                    p.append(cylNode(m.grille, r: 0.045, h: 0.01, at: V(x, 0.341, z)))
                }
            }
            return group("addon", p)
        },
        AddonStyle(id: "vents") { m, _ in
            var p: [SCNNode] = []
            for z: Float in [0.24, -0.24] {
                p.append(boxNode(m.trim, 0.5, 0.03, 0.26, r: 0.02, at: V(0, 0.01, z)))
                for i in 0..<5 {
                    let l = boxNode(m.grille, 0.035, 0.04, 0.22, at: V(-0.18 + Float(i) * 0.09, 0.035, z))
                    l.eulerAngles.z = 0.5
                    p.append(l)
                }
            }
            return group("addon", p)
        },
    ]

    // MARK: Front (on the nose)

    static let frontParts: [AddonStyle] = [
        AddonStyle(id: "none", build: nil),
        AddonStyle(id: "bullbar") { m, b in
            let w = b.nose.width / 2
            let bar = m.plastic
            var p: [SCNNode] = [
                rod(bar, V(0.14, -0.05, -w * 0.95), V(0.14, -0.05, w * 0.95), r: 0.05),
                rod(bar, V(0.2, 0.42, -0.36), V(0.2, 0.42, 0.36), r: 0.045),
            ]
            for s: Float in [1, -1] {
                p.append(rod(bar, V(0.14, -0.05, s * 0.36), V(0.2, 0.42, s * 0.36), r: 0.045))
                p.append(rod(bar, V(0.2, 0.42, s * 0.36), V(0.14, -0.05, s * w * 0.8), r: 0.04))
                p.append(rod(bar, V(0.0, -0.05, s * 0.36), V(0.14, -0.05, s * 0.36), r: 0.04))
                p += Parts.roundLamp(m, x: 0.26, y: 0.52, z: s * 0.22, r: 0.07)
            }
            return group("addon", p)
        },
        AddonStyle(id: "lip") { m, b in
            let w = CGFloat(b.nose.width) * 0.82
            var p: [SCNNode] = [boxNode(m.trim, 0.34, 0.035, w, r: 0.015, at: V(-0.07, -0.04, 0))]
            for s: Float in [1, -1] {
                p.append(boxNode(m.trim, 0.26, 0.08, 0.03, r: 0.01, at: V(-0.09, -0.01, s * Float(w) / 2)))
            }
            return group("addon", p)
        },
        AddonStyle(id: "foglights") { m, b in
            let yellowLens = SCNMaterial.pbr(UIColor(red: 1, green: 0.9, blue: 0.3, alpha: 1), rough: 0.1,
                                             emission: UIColor(red: 1, green: 0.8, blue: 0.2, alpha: 1))
            var p: [SCNNode] = [rod(m.trim, V(0.08, 0.05, -0.62), V(0.08, 0.05, 0.62), r: 0.03)]
            for s: Float in [1, -1] {
                p.append(cylNode(m.trim, r: 0.12, h: 0.12, axis: .x, at: V(0.14, 0.12, s * 0.42)))
                p += Parts.roundLamp(m, x: 0.21, y: 0.12, z: s * 0.42, r: 0.11, lens: yellowLens)
            }
            return group("addon", p)
        },
        AddonStyle(id: "plow") { m, b in
            let ground = -b.nose.p.y
            let blade = UIBezierPath()
            blade.addArc(withCenter: CGPoint(x: 0.75, y: 0.3), radius: 0.42, startAngle: -.pi / 2, endAngle: .pi * 0.62, clockwise: false)
            blade.addArc(withCenter: CGPoint(x: 0.75, y: 0.3), radius: 0.34, startAngle: .pi * 0.62, endAngle: -.pi / 2, clockwise: true)
            blade.close()
            let bladeNode = extrude(blade, depth: CGFloat(b.nose.width) + 0.5, chamfer: 0.02, m.yellow)
            bladeNode.position = V(0, ground + 0.15, 0)
            var p = [bladeNode,
                     boxNode(m.trim, 0.1, 0.06, CGFloat(b.nose.width) + 0.5, r: 0.02, at: V(0.75, ground + 0.06, 0))]
            for s: Float in [1, -1] {
                p.append(rod(m.trim, V(0.0, 0.0, s * 0.35), V(0.5, ground + 0.4, s * 0.35), r: 0.05))
                p.append(boxNode(m.trim, 0.15, 0.2, 0.08, r: 0.02, at: V(0.0, 0.0, s * 0.35)))
            }
            return group("addon", p)
        },
    ]

    // MARK: Roof

    static let roofParts: [AddonStyle] = [
        AddonStyle(id: "none", build: nil),
        AddonStyle(id: "police") { m, b in
            let red = SCNMaterial.pbr(UIColor(red: 1, green: 0.1, blue: 0.1, alpha: 1), rough: 0.15, emission: .red)
            let blue = SCNMaterial.pbr(UIColor(red: 0.15, green: 0.35, blue: 1, alpha: 1), rough: 0.15,
                                       emission: UIColor(red: 0.1, green: 0.3, blue: 1, alpha: 1))
            let w = CGFloat(min(b.roof.width * 0.85, 1.25))
            let node = group("addon", [
                boxNode(m.trim, 0.3, 0.06, w, r: 0.02, at: V(0, 0.03, 0)),
                boxNode(red, 0.26, 0.14, w / 2 - 0.04, r: 0.05, at: V(0, 0.13, Float(w) / 4 + 0.01)),
                boxNode(blue, 0.26, 0.14, w / 2 - 0.04, r: 0.05, at: V(0, 0.13, -Float(w) / 4 - 0.01)),
                boxNode(m.white, 0.27, 0.05, 0.08, r: 0.02, at: V(0, 0.13, 0)),
            ])
            let flip = SCNAction.sequence([
                .run { _ in red.emission.intensity = 1.8; blue.emission.intensity = 0.05 }, .wait(duration: 0.25),
                .run { _ in red.emission.intensity = 0.05; blue.emission.intensity = 1.8 }, .wait(duration: 0.25),
            ])
            node.runAction(.repeatForever(flip))
            return node
        },
        AddonStyle(id: "lightbar") { m, b in
            let w = CGFloat(min(b.roof.width * 0.95, 1.45))
            var p: [SCNNode] = [boxNode(m.trim, 0.14, 0.13, w, r: 0.04, at: V(0.25, 0.12, 0))]
            let n = 6
            for i in 0..<n {
                let z = (Float(i) + 0.5) / Float(n) * Float(w) - Float(w) / 2
                p.append(boxNode(m.headlight, 0.02, 0.09, w / CGFloat(n) - 0.04, r: 0.02, at: V(0.325, 0.12, z)))
            }
            for s: Float in [1, -1] { p.append(boxNode(m.trim, 0.2, 0.08, 0.05, r: 0.02, at: V(0.15, 0.03, s * Float(w) * 0.42))) }
            return group("addon", p)
        },
        AddonStyle(id: "rack") { m, b in
            let w = min(b.roof.width * 0.8, 1.3)
            var p: [SCNNode] = []
            for s: Float in [1, -1] {
                p.append(rod(m.trim, V(-0.55, 0.1, s * w / 2), V(0.55, 0.1, s * w / 2), r: 0.03))
                p.append(boxNode(m.trim, 0.08, 0.1, 0.06, at: V(-0.45, 0.05, s * w / 2)))
                p.append(boxNode(m.trim, 0.08, 0.1, 0.06, at: V(0.45, 0.05, s * w / 2)))
            }
            for x: Float in [-0.4, 0, 0.4] { p.append(rod(m.trim, V(x, 0.1, -w / 2), V(x, 0.1, w / 2), r: 0.025)) }
            let box = UIBezierPath(roundedRect: CGRect(x: -0.5, y: 0.12, width: 0.95, height: 0.22), cornerRadius: 0.1)
            p.append(extrude(box, depth: CGFloat(w) * 0.75, chamfer: 0.06, m.plastic))
            return group("addon", p)
        },
        AddonStyle(id: "beacon") { m, _ in
            let lens = SCNMaterial.pbr(UIColor(red: 1, green: 0.6, blue: 0.1, alpha: 0.75), rough: 0.1,
                                       emission: UIColor(red: 0.9, green: 0.45, blue: 0.0, alpha: 1))
            let spinner = group(nil, [boxNode(m.chrome, 0.04, 0.12, 0.18, at: V(0.06, 0.2, 0))])
            spinner.runAction(.repeatForever(.rotateBy(x: 0, y: .pi * 2, z: 0, duration: 0.6)))
            return group("addon", [
                cylNode(m.trim, r: 0.2, h: 0.06, at: V(0, 0.03, 0)),
                sphereNode(lens, r: 0.17, at: V(0, 0.12, 0), scale: V(1, 1.2, 1)),
                spinner,
            ])
        },
    ]

    // MARK: Back (on the rear deck)

    static let backParts: [AddonStyle] = [
        AddonStyle(id: "none", build: nil),
        AddonStyle(id: "ducktail") { m, b in
            let path = UIBezierPath()
            path.move(to: CGPoint(x: 0.25, y: -0.02)); path.l(-0.2, -0.02); path.l(-0.24, 0.13); path.q(0.25, 0.0, -0.05, 0.05); path.close()
            return group("addon", [extrude(path, depth: CGFloat(b.deck.width), chamfer: 0.03, m.paint)])
        },
        AddonStyle(id: "wing") { m, b in
            let span = CGFloat(min(b.deck.width * 1.05, 1.9))
            var p: [SCNNode] = [Catalog.airfoil(m.trim, chord: 0.5, thickness: 0.09, span: span, at: V(-0.05, 0.5, 0))]
            for s: Float in [1, -1] {
                p.append(boxNode(m.paint, 0.56, 0.3, 0.03, r: 0.01, at: V(-0.06, 0.5, s * Float(span) / 2)))
                // swan-neck upright
                let neck = UIBezierPath()
                neck.move(to: CGPoint(x: 0.1, y: 0)); neck.l(0.2, 0); neck.q(0.05, 0.52, 0.22, 0.4); neck.l(-0.05, 0.52); neck.q(0.1, 0, 0.12, 0.38); neck.close()
                let n = extrude(neck, depth: 0.05, chamfer: 0.01, m.trim)
                n.position.z = s * Float(span) * 0.3
                p.append(n)
            }
            return group("addon", p)
        },
        AddonStyle(id: "rockets") { m, _ in
            let flame = SCNMaterial.pbr(.orange, rough: 0.4, emission: UIColor(red: 1, green: 0.55, blue: 0.05, alpha: 1))
            var parts: [SCNNode] = []
            for side: Float in [1, -1] {
                parts.append(cylNode(m.chrome, r: 0.13, h: 0.8, axis: .x, at: V(0.05, 0.18, side * 0.42)))
                parts.append(coneNode(m.taillight, top: 0, bottom: 0.13, h: 0.3, axis: .x, at: V(0.6, 0.18, side * 0.42)))
                parts.append(cylNode(m.gunmetal, r: 0.1, h: 0.1, axis: .x, at: V(-0.38, 0.18, side * 0.42)))
                for fin: Float in [0, 2.1, 4.2] {
                    let f = boxNode(m.taillight, 0.25, 0.14, 0.02, at: V(-0.25, 0.24, 0))
                    let arm = SCNNode(); arm.position = V(0, 0.18 - 0.18, side * 0.42); arm.eulerAngles.x = fin
                    f.position = V(-0.25, 0.14, 0)
                    arm.position = V(0, 0.18, side * 0.42)
                    arm.addChildNode(f)
                    parts.append(arm)
                }
                let fl = coneNode(flame, top: 0, bottom: 0.1, h: 0.4, axis: .negX, at: V(-0.62, 0.18, side * 0.42))
                fl.runAction(.repeatForever(.sequence([.scale(to: 1.25, duration: 0.09), .scale(to: 0.85, duration: 0.09)])))
                parts.append(fl)
            }
            return group("addon", parts)
        },
        AddonStyle(id: "stacks") { m, b in
            var p: [SCNNode] = []
            let z = min(b.deck.width / 2 - 0.12, 0.62)
            for s: Float in [1, -1] {
                p.append(cylNode(m.chrome, r: 0.07, h: 1.0, at: V(0.0, 0.5, s * z)))
                p.append(cylNode(m.trim, r: 0.085, h: 0.4, at: V(0.0, 0.4, s * z)))
                let cap = cylNode(m.chrome, r: 0.075, h: 0.12, at: V(-0.02, 1.02, s * z))
                cap.eulerAngles.z = 0.6
                p.append(cap)
            }
            return group("addon", p)
        },
    ]
}
