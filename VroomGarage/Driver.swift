import SceneKit
import UIKit

/// A friendly little driver who sits in every car. Built facing +X with the seat at y = 0.
enum Driver {
    static let suit = SCNMaterial.pbr(UIColor(red: 0.10, green: 0.14, blue: 0.24, alpha: 1), rough: 0.7)
    static let glove = SCNMaterial.pbr(UIColor(white: 0.1, alpha: 1), rough: 0.55)
    static let dark = SCNMaterial.pbr(UIColor(white: 0.06, alpha: 1), rough: 0.35)
    static let visor = SCNMaterial.pbr(UIColor(red: 0.08, green: 0.12, blue: 0.2, alpha: 1), metal: 0.85, rough: 0.06, clearCoat: true)

    static func make(_ m: CarMaterials) -> SCNNode {
        let root = SCNNode()
        root.name = "driver"

        // Racing suit: torso, shoulders with white piping.
        let torso = SCNNode(geometry: SCNCapsule(capRadius: 0.17, height: 0.5))
        torso.geometry?.materials = [suit]
        torso.position = V(0, 0.25, 0)
        torso.scale = V(0.9, 1, 1.05)
        root.addChildNode(torso)
        root.addChildNode(boxNode(m.white, 0.05, 0.3, 0.02, r: 0.01, at: V(0.15, 0.27, 0.07)))
        root.addChildNode(torusNode(dark, ring: 0.085, pipe: 0.035, at: V(0, 0.5, 0)))   // neck collar

        // Steering wheel with a hub, and gloved hands at ten-to-two.
        let wheel = SCNNode()
        wheel.position = V(0.32, 0.42, 0)
        wheel.eulerAngles = V(0, 0, -1.2)
        wheel.addChildNode(torusNode(dark, ring: 0.13, pipe: 0.022, at: V(0, 0, 0)))
        wheel.addChildNode(cylNode(m.gunmetal, r: 0.04, h: 0.03, at: V(0, 0, 0)))
        wheel.addChildNode(boxNode(m.gunmetal, 0.22, 0.012, 0.03, at: V(0, 0, 0)))
        root.addChildNode(wheel)
        for side: Float in [1, -1] {
            let arm = SCNNode(geometry: SCNCapsule(capRadius: 0.05, height: 0.32))
            arm.geometry?.materials = [suit]
            arm.position = V(0.16, 0.38, side * 0.12)
            arm.eulerAngles = V(0, 0, -1.15)
            root.addChildNode(arm)
            root.addChildNode(sphereNode(glove, r: 0.048, at: V(0.31, 0.47, side * 0.1), scale: V(1, 0.9, 1.1)))
        }

        // Full-face helmet in the car's colour, with a dark wraparound visor.
        let head = SCNNode()
        head.name = "head"
        head.position = V(0, 0.66, 0)
        root.addChildNode(head)
        head.addChildNode(sphereNode(m.paint, r: 0.2, at: V(0, 0, 0), scale: V(1.06, 1, 0.95)))
        head.addChildNode(sphereNode(visor, r: 0.185, at: V(0.035, 0.0, 0), scale: V(1.0, 0.44, 0.92)))
        // chin bar and white crown stripe
        head.addChildNode(sphereNode(m.paint, r: 0.15, at: V(0.06, -0.085, 0), scale: V(1, 0.7, 1.05)))
        head.addChildNode(torusNode(m.white, ring: 0.198, pipe: 0.012, axis: .z, at: V(0, 0.0, 0)))
        head.addChildNode(boxNode(dark, 0.05, 0.02, 0.06, r: 0.008, at: V(0.2, -0.11, 0)))   // chin vent

        // Bob along to the engine.
        head.runAction(.repeatForever(.sequence([
            .moveBy(x: 0, y: 0.02, z: 0, duration: 0.35),
            .moveBy(x: 0, y: -0.02, z: 0, duration: 0.35),
            .wait(duration: 0.5),
        ])))
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
