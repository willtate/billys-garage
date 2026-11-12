import SceneKit
import UIKit

/// Soft rounded hills, lollipop trees and puffy clouds around the garage.
enum Scenery {
    static func make() -> SCNNode {
        let root = SCNNode()
        root.name = "scenery"
        var rng = SeededRandom(seed: 7)

        let grass = SCNMaterial.pbr(UIColor(red: 0.55, green: 0.85, blue: 0.45, alpha: 1), rough: 0.9)
        let grassDark = SCNMaterial.pbr(UIColor(red: 0.40, green: 0.75, blue: 0.38, alpha: 1), rough: 0.9)
        let trunk = SCNMaterial.pbr(UIColor(red: 0.55, green: 0.36, blue: 0.22, alpha: 1), rough: 0.8)
        let leaves = [
            SCNMaterial.pbr(UIColor(red: 0.30, green: 0.75, blue: 0.30, alpha: 1), rough: 0.7),
            SCNMaterial.pbr(UIColor(red: 0.45, green: 0.82, blue: 0.25, alpha: 1), rough: 0.7),
            SCNMaterial.pbr(UIColor(red: 0.20, green: 0.65, blue: 0.40, alpha: 1), rough: 0.7),
        ]
        let cloud = SCNMaterial.pbr(.white, rough: 1, emission: UIColor(white: 0.35, alpha: 1))
        let flowerColors: [UIColor] = [.systemPink, .systemYellow, .white, .systemOrange, .systemPurple]

        // Hills far away
        for i in 0..<9 {
            let a = Float(i) / 9 * 2 * .pi + rng.next(-0.2, 0.2)
            let d = rng.next(24, 30)
            let r = CGFloat(rng.next(5, 9))
            let hill = sphereNode(i % 2 == 0 ? grass : grassDark, r: r, at: V(cos(a) * d, -Float(r) * 0.55, sin(a) * d),
                                  scale: V(1.6, 1, 1.2))
            root.addChildNode(hill)
        }

        // Trees in a loose ring
        for i in 0..<16 {
            let a = Float(i) / 16 * 2 * .pi + rng.next(-0.15, 0.15)
            let d = rng.next(8.5, 13)
            let s = rng.next(0.8, 1.4)
            // Keep the camera's line of sight (it looks from +Z) clear.
            if abs(a - .pi / 2) < 0.75 { continue }
            let tree = SCNNode()
            tree.position = V(cos(a) * d, -0.25, sin(a) * d)
            tree.scale = V(s, s, s)
            let leaf = leaves[i % leaves.count]
            switch i % 4 {
            case 0: // round
                tree.addChildNode(cylNode(trunk, r: 0.16, h: 1.2, at: V(0, 0.6, 0)))
                tree.addChildNode(sphereNode(leaf, r: 0.8, at: V(0, 1.6, 0)))
                tree.addChildNode(sphereNode(leaf, r: 0.55, at: V(0.45, 1.3, 0.2)))
                tree.addChildNode(sphereNode(leaf, r: 0.5, at: V(-0.4, 1.35, -0.2)))
            case 1: // pine
                tree.addChildNode(cylNode(trunk, r: 0.13, h: 0.7, at: V(0, 0.35, 0)))
                tree.addChildNode(coneNode(leaves[2], top: 0, bottom: 0.85, h: 1.1, at: V(0, 1.1, 0)))
                tree.addChildNode(coneNode(leaves[2], top: 0, bottom: 0.65, h: 0.95, at: V(0, 1.65, 0)))
                tree.addChildNode(coneNode(leaves[2], top: 0, bottom: 0.45, h: 0.8, at: V(0, 2.15, 0)))
            case 2: // bush with berries
                let berry = SCNMaterial.pbr(.systemRed, rough: 0.3)
                tree.addChildNode(sphereNode(leaf, r: 0.6, at: V(0, 0.4, 0), scale: V(1.3, 0.8, 1.1)))
                tree.addChildNode(sphereNode(leaf, r: 0.45, at: V(0.6, 0.3, 0.1)))
                for b in 0..<6 {
                    let ba = Float(b) * 1.05
                    tree.addChildNode(sphereNode(berry, r: 0.07, at: V(cos(ba) * 0.6, 0.55 + Float(b % 2) * 0.12, sin(ba) * 0.55)))
                }
            default: // tall poplar
                tree.addChildNode(cylNode(trunk, r: 0.12, h: 0.8, at: V(0, 0.4, 0)))
                tree.addChildNode(capsuleNode(leaves[1], r: 0.5, h: 2.4, at: V(0, 1.9, 0)))
            }
            tree.runAction(.repeatForever(.sequence([
                .rotateTo(x: 0, y: 0, z: 0.03, duration: 1.8 + Double(i % 3) * 0.3),
                .rotateTo(x: 0, y: 0, z: -0.03, duration: 1.8 + Double(i % 3) * 0.3),
            ])))
            root.addChildNode(tree)
        }

        // Flowers sprinkled on the grass
        for i in 0..<40 {
            let a = rng.next(0, 2 * .pi)
            let d = rng.next(7.2, 10)
            let mat = SCNMaterial.pbr(flowerColors[i % flowerColors.count], rough: 0.5)
            let f = SCNNode()
            f.position = V(cos(a) * d, -0.25, sin(a) * d)
            f.addChildNode(cylNode(grassDark, r: 0.02, h: 0.3, at: V(0, 0.15, 0)))
            f.addChildNode(sphereNode(SCNMaterial.pbr(.systemYellow, rough: 0.5), r: 0.06, at: V(0, 0.33, 0)))
            for k in 0..<5 {
                let pa = Float(k) / 5 * 2 * .pi
                f.addChildNode(sphereNode(mat, r: 0.06, at: V(cos(pa) * 0.09, 0.32, sin(pa) * 0.09), scale: V(1, 0.5, 1)))
            }
            root.addChildNode(f)
        }

        // A road ring around the garage for laps
        let asphalt = SCNMaterial.pbr(UIColor(white: 0.32, alpha: 1), rough: 0.85)
        let road = SCNNode(geometry: SCNTube(innerRadius: 4.9, outerRadius: 6.7, height: 0.04))
        road.geometry?.materials = [asphalt]
        (road.geometry as? SCNTube)?.radialSegmentCount = 96
        road.position = V(0, -0.25, 0)
        root.addChildNode(road)
        let paint = SCNMaterial.pbr(.white, rough: 0.5)
        let curbRed = SCNMaterial.pbr(UIColor(red: 0.95, green: 0.2, blue: 0.2, alpha: 1), rough: 0.6)
        for i in 0..<36 {
            let a = Float(i) / 36 * 2 * .pi
            let dash = boxNode(paint, 0.12, 0.02, 0.55, at: V(cos(a) * 5.8, -0.22, sin(a) * 5.8))
            dash.eulerAngles.y = -a
            root.addChildNode(dash)
        }
        for i in 0..<72 {
            let a = (Float(i) + 0.5) / 72 * 2 * .pi
            let curb = boxNode(i % 2 == 0 ? curbRed : paint, 0.16, 0.08, 0.5, r: 0.03, at: V(cos(a) * 6.75, -0.21, sin(a) * 6.75))
            curb.eulerAngles.y = -a
            root.addChildNode(curb)
        }

        // A toy town on the horizon
        let wallColors: [UIColor] = [
            UIColor(red: 1.0, green: 0.85, blue: 0.55, alpha: 1), UIColor(red: 0.6, green: 0.85, blue: 1.0, alpha: 1),
            UIColor(red: 1.0, green: 0.7, blue: 0.75, alpha: 1), UIColor(red: 0.75, green: 0.95, blue: 0.7, alpha: 1),
            UIColor(white: 0.97, alpha: 1), UIColor(red: 0.85, green: 0.75, blue: 1.0, alpha: 1),
        ]
        let roofColors: [UIColor] = [.systemRed, .systemBlue, .systemOrange, UIColor(red: 0.45, green: 0.3, blue: 0.75, alpha: 1)]
        let window = SCNMaterial.pbr(UIColor(red: 0.55, green: 0.8, blue: 1.0, alpha: 1), rough: 0.1)
        let door = SCNMaterial.pbr(UIColor(red: 0.5, green: 0.3, blue: 0.18, alpha: 1), rough: 0.6)
        for i in 0..<14 {
            let a = Float(i) / 14 * 2 * .pi + rng.next(-0.08, 0.08)
            if abs(a - .pi / 2) < 0.6 { continue }
            let d = rng.next(15, 19)
            let w = CGFloat(rng.next(1.6, 2.6)), h = CGFloat(rng.next(1.4, 3.2)), dep = CGFloat(1.6)
            let wall = SCNMaterial.pbr(wallColors[i % wallColors.count], rough: 0.6)
            let roof = SCNMaterial.pbr(roofColors[i % roofColors.count], rough: 0.5)
            let house = SCNNode()
            house.position = V(cos(a) * d, -0.25, sin(a) * d)
            house.eulerAngles.y = -a - .pi / 2   // front faces the garage
            house.addChildNode(boxNode(wall, w, h, dep, r: 0.08, at: V(0, Float(h) / 2, 0)))
            let pyr = SCNNode(geometry: SCNPyramid(width: w + 0.3, height: 1.0, length: dep + 0.3))
            pyr.geometry?.materials = [roof]
            pyr.position = V(0, Float(h), 0)
            house.addChildNode(pyr)
            house.addChildNode(boxNode(door, 0.45, 0.8, 0.05, r: 0.05, at: V(0, 0.4, Float(dep) / 2)))
            if i % 3 == 0 {
                house.addChildNode(boxNode(SCNMaterial.pbr(UIColor(red: 0.7, green: 0.35, blue: 0.3, alpha: 1), rough: 0.7),
                                           0.3, 0.8, 0.3, at: V(Float(w) * 0.25, Float(h) + 0.5, 0)))
            }
            if i % 3 == 1 {
                // striped shop awning over the door
                let stripe = SCNMaterial.pbr(roofColors[(i + 1) % roofColors.count], rough: 0.5)
                for k in 0..<4 {
                    house.addChildNode(boxNode(k % 2 == 0 ? stripe : SCNMaterial.pbr(.white, rough: 0.5),
                                               Float(w) > 0 ? w / 4 : 0.4, 0.06, 0.5,
                                               at: V(-Float(w) * 0.375 + Float(k) * Float(w) * 0.25, 1.05, Float(dep) / 2 + 0.2)))
                }
            }
            let rows = max(1, Int(h / 1.1))
            for r in 0..<rows {
                for c in [-1, 1] {
                    let wy = 0.95 + Float(r) * 1.0
                    if wy + 0.3 > Float(h) { continue }
                    house.addChildNode(boxNode(window, 0.4, 0.4, 0.05, r: 0.04, at: V(Float(c) * Float(w) * 0.28, wy, Float(dep) / 2)))
                }
            }
            root.addChildNode(house)
        }

        // Clouds drifting slowly round the sky
        let sky = SCNNode()
        for i in 0..<7 {
            let a = Float(i) / 7 * 2 * .pi + rng.next(-0.3, 0.3)
            let d = rng.next(16, 22)
            let c = SCNNode()
            c.position = V(cos(a) * d, rng.next(7, 10), sin(a) * d)
            c.addChildNode(sphereNode(cloud, r: 1.0, at: V(0, 0, 0)))
            c.addChildNode(sphereNode(cloud, r: 0.75, at: V(1.0, -0.2, 0.2)))
            c.addChildNode(sphereNode(cloud, r: 0.7, at: V(-1.0, -0.25, -0.1)))
            c.addChildNode(sphereNode(cloud, r: 0.55, at: V(0.3, 0.55, 0.1)))
            c.scale = V(1.2, 0.9, 1.0)
            sky.addChildNode(c)
        }
        sky.runAction(.repeatForever(.rotateBy(x: 0, y: .pi * 2, z: 0, duration: 240)))
        root.addChildNode(sky)
        return root
    }
}

struct SeededRandom {
    private var state: UInt64
    init(seed: UInt64) { state = seed &* 0x9E3779B97F4A7C15 }
    mutating func next() -> Float {
        state = state &* 6364136223846793005 &+ 1442695040888963407
        return Float(state >> 40) / Float(1 << 24)
    }
    mutating func next(_ lo: Float, _ hi: Float) -> Float { lo + (hi - lo) * next() }
}
