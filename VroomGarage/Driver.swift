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
        head.position = V(0, 0.64, 0)
        head.scale = V(1.0, 1.0, 1.0)   // friendly but in proportion
        root.addChildNode(head)

        head.addChildNode(sphereNode(skin, r: 0.2, at: V(0, 0, 0)))
        // Helmet in the car's paint colour, with a white stripe and a visor brim.
        let helmet = sphereNode(m.paint, r: 0.215, at: V(-0.02, 0.05, 0), scale: V(1, 0.82, 1))
        head.addChildNode(helmet)
        head.addChildNode(boxNode(m.white, 0.36, 0.05, 0.08, r: 0.02, at: V(-0.05, 0.235, 0)))
        // Face: covers the front of the head below the helmet
        head.addChildNode(sphereNode(skin, r: 0.19, at: V(0.025, -0.02, 0)))

        for side: Float in [1, -1] {
            let eye = sphereNode(dark, r: 0.045, at: V(0.175, 0.01, side * 0.08), scale: V(0.6, 1.2, 1))
            eye.name = "eye"
            head.addChildNode(eye)
            head.addChildNode(sphereNode(m.white, r: 0.016, at: V(0.2, 0.035, side * 0.07)))
            head.addChildNode(sphereNode(cheek, r: 0.04, at: V(0.165, -0.07, side * 0.12), scale: V(0.5, 0.8, 1)))
        }

        // Big smile: a half-disc facing forward
        let path = UIBezierPath(arcCenter: .zero, radius: 0.085, startAngle: 0, endAngle: .pi, clockwise: false)
        path.close()
        path.flatness = 0.004
        let smileShape = SCNShape(path: path, extrusionDepth: 0.02)
        let smile = SCNNode(geometry: smileShape)
        smile.geometry?.materials = [mouth]
        smile.position = V(0.19, -0.065, 0)
        smile.eulerAngles = V(0, .pi / 2, 0)
        head.addChildNode(smile)

        // Bob along to the music, glance around, blink.
        head.runAction(.repeatForever(.sequence([
            .moveBy(x: 0, y: 0.03, z: 0, duration: 0.35),
            .moveBy(x: 0, y: -0.03, z: 0, duration: 0.35),
            .wait(duration: 0.4),
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

    /// Turn the driver's head toward the camera so the kid always gets a smile.
    static func lookAt(_ driver: SCNNode, camera: SCNNode) {
        guard let head = driver.childNode(withName: "head", recursively: false) else { return }
        let look = SCNLookAtConstraint(target: camera)
        look.localFront = V(1, 0, 0)
        look.isGimbalLockEnabled = true
        look.influenceFactor = 0.75
        head.constraints = [look]
    }

    /// A happy little jump when something changes.
    static func cheer(_ driver: SCNNode) {
        let up = SCNAction.moveBy(x: 0, y: 0.18, z: 0, duration: 0.12); up.timingMode = .easeOut
        let down = SCNAction.moveBy(x: 0, y: -0.18, z: 0, duration: 0.14); down.timingMode = .easeIn
        driver.runAction(.sequence([up, down, up, down]), forKey: "cheer")
    }
}
