import SceneKit
import UIKit

/// A friendly little driver who sits in every car. Built facing +X with the seat at y = 0.
enum Driver {
    static let skin = SCNMaterial.pbr(UIColor(red: 1.0, green: 0.80, blue: 0.64, alpha: 1), rough: 0.6)
    static let shirt = SCNMaterial.pbr(UIColor(red: 0.20, green: 0.45, blue: 0.95, alpha: 1), rough: 0.6)
    static let dark = SCNMaterial.pbr(UIColor(white: 0.08, alpha: 1), rough: 0.3)
    static let cheek = SCNMaterial.pbr(UIColor(red: 1.0, green: 0.55, blue: 0.6, alpha: 1), rough: 0.7)
    static let mouth = SCNMaterial.pbr(UIColor(red: 0.55, green: 0.1, blue: 0.12, alpha: 1), rough: 0.5)
    static let visor = SCNMaterial.pbr(UIColor(red: 0.15, green: 0.2, blue: 0.3, alpha: 1), metal: 0.4, rough: 0.1)

    static func make(_ m: CarMaterials) -> SCNNode {
        let root = SCNNode()
        root.name = "driver"

        let torso = SCNNode(geometry: SCNCapsule(capRadius: 0.17, height: 0.5))
        torso.geometry?.materials = [shirt]
        torso.position = V(0, 0.25, 0)
        root.addChildNode(torso)

        // Hands on a steering wheel
        let wheel = torusNode(dark, ring: 0.13, pipe: 0.025, at: V(0.3, 0.42, 0))
        wheel.eulerAngles = V(0, 0, -1.2)
        root.addChildNode(wheel)
        for side: Float in [1, -1] {
            let arm = SCNNode(geometry: SCNCapsule(capRadius: 0.05, height: 0.32))
            arm.geometry?.materials = [shirt]
            arm.position = V(0.16, 0.38, side * 0.12)
            arm.eulerAngles = V(0, 0, -1.15)
            root.addChildNode(arm)
            root.addChildNode(sphereNode(skin, r: 0.05, at: V(0.3, 0.44, side * 0.11)))
        }

        let head = SCNNode()
        head.name = "head"
        head.position = V(0, 0.62, 0)
        root.addChildNode(head)

        head.addChildNode(sphereNode(skin, r: 0.2, at: V(0, 0, 0)))
        // Helmet in the car's paint colour, with a white stripe and a visor brim.
        let helmet = sphereNode(m.paint, r: 0.215, at: V(-0.02, 0.05, 0), scale: V(1, 0.82, 1))
        head.addChildNode(helmet)
        head.addChildNode(boxNode(m.white, 0.42, 0.05, 0.08, r: 0.02, at: V(-0.02, 0.2, 0)))
        head.addChildNode(cylNode(visor, r: 0.17, h: 0.025, at: V(0.12, 0.08, 0)))
        // Face: covers the front of the head below the helmet
        head.addChildNode(sphereNode(skin, r: 0.19, at: V(0.025, -0.02, 0)))

        for side: Float in [1, -1] {
            let eye = sphereNode(dark, r: 0.036, at: V(0.18, 0.0, side * 0.075), scale: V(0.6, 1.15, 1))
            eye.name = "eye"
            head.addChildNode(eye)
            head.addChildNode(sphereNode(m.white, r: 0.012, at: V(0.2, 0.015, side * 0.07)))
            head.addChildNode(sphereNode(cheek, r: 0.04, at: V(0.165, -0.07, side * 0.12), scale: V(0.5, 0.8, 1)))
        }

        // Big smile: a half-disc facing forward
        let path = UIBezierPath(arcCenter: .zero, radius: 0.07, startAngle: 0, endAngle: .pi, clockwise: false)
        path.close()
        let smile = SCNNode(geometry: SCNShape(path: path, extrusionDepth: 0.02))
        smile.geometry?.materials = [mouth]
        smile.position = V(0.19, -0.065, 0)
        smile.eulerAngles = V(0, .pi / 2, 0)
        head.addChildNode(smile)

        // Bob along to the music, glance around, blink.
        head.runAction(.repeatForever(.sequence([
            .rotateTo(x: 0, y: 0.35, z: 0.06, duration: 0.6, usesShortestUnitArc: true),
            .wait(duration: 1.6),
            .rotateTo(x: 0, y: -0.3, z: -0.06, duration: 0.6, usesShortestUnitArc: true),
            .wait(duration: 1.2),
            .rotateTo(x: 0, y: 0, z: 0, duration: 0.5, usesShortestUnitArc: true),
            .wait(duration: 2.0),
        ])))
        let blink = SCNAction.sequence([
            .wait(duration: 2.6, withRange: 2.0),
            .customAction(duration: 0.12) { node, t in
                let k = Float(abs(t / 0.06 - 1))
                node.childNodes.filter { $0.name == "eye" }.forEach { $0.scale.y = 1.15 * max(0.1, k) }
            },
        ])
        head.runAction(.repeatForever(blink))
        return root
    }

    /// A happy little jump when something changes.
    static func cheer(_ driver: SCNNode) {
        let up = SCNAction.moveBy(x: 0, y: 0.18, z: 0, duration: 0.12); up.timingMode = .easeOut
        let down = SCNAction.moveBy(x: 0, y: -0.18, z: 0, duration: 0.14); down.timingMode = .easeIn
        driver.runAction(.sequence([up, down, up, down]), forKey: "cheer")
    }
}
