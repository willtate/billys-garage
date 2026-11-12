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
            tree.position = V(cos(a) * d, 0, sin(a) * d)
            tree.scale = V(s, s, s)
            tree.addChildNode(cylNode(trunk, r: 0.16, h: 1.2, at: V(0, 0.6, 0)))
            let leaf = leaves[i % leaves.count]
            tree.addChildNode(sphereNode(leaf, r: 0.8, at: V(0, 1.6, 0)))
            tree.addChildNode(sphereNode(leaf, r: 0.55, at: V(0.45, 1.3, 0.2)))
            tree.addChildNode(sphereNode(leaf, r: 0.5, at: V(-0.4, 1.35, -0.2)))
            tree.runAction(.repeatForever(.sequence([
                .rotateTo(x: 0, y: 0, z: 0.03, duration: 1.8 + Double(i % 3) * 0.3),
                .rotateTo(x: 0, y: 0, z: -0.03, duration: 1.8 + Double(i % 3) * 0.3),
            ])))
            root.addChildNode(tree)
        }

        // Flowers sprinkled on the grass
        for i in 0..<40 {
            let a = rng.next(0, 2 * .pi)
            let d = rng.next(4.5, 9)
            let mat = SCNMaterial.pbr(flowerColors[i % flowerColors.count], rough: 0.5)
            let f = SCNNode()
            f.position = V(cos(a) * d, 0, sin(a) * d)
            f.addChildNode(cylNode(grassDark, r: 0.02, h: 0.3, at: V(0, 0.15, 0)))
            f.addChildNode(sphereNode(mat, r: 0.1, at: V(0, 0.32, 0)))
            root.addChildNode(f)
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
