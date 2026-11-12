import SceneKit
import UIKit

/// A car assembled from parts, with handles on the pieces we animate.
struct BuiltCar {
    let root: SCNNode
    let body: SCNNode
    let wheelMounts: [SCNNode]
    let spinners: [SCNNode]
    let addons: [AddonSlot: SCNNode]
    let sticker: SCNNode?
    let driver: SCNNode
    /// Where exhaust smoke comes out, in car space.
    let tailpipe: SCNVector3
}

enum CarBuilder {
    static func build(_ design: CarDesign, materials m: CarMaterials) -> BuiltCar {
        let body = Catalog.body(design.body)
        let wheel = Catalog.wheel(design.wheels)

        // Wheels are sized relative to the body, then scaled by the wheel style.
        let radius = body.wheelRadius * wheel.scale
        let width = body.wheelWidth * wheel.widthScale
        let lift = radius - body.wheelRadius   // bigger wheels raise the whole body

        let root = SCNNode()
        root.name = "car"

        let shell = body.build(m, radius)
        let bodyNode = shell.node
        bodyNode.position.y += lift
        root.addChildNode(bodyNode)

        let sticker = Stickers.make(design.sticker, bodyID: body.id, shell: shell, m: m)
        if let s = sticker { bodyNode.addChildNode(s) }

        let driver = Driver.make(m)
        driver.position = body.seat
        driver.scale = V(body.driverScale, body.driverScale, body.driverScale)
        bodyNode.addChildNode(driver)

        var addons: [AddonSlot: SCNNode] = [:]
        for slot in AddonSlot.allCases {
            guard let make = Catalog.addon(slot, design.addon(slot)).build else { continue }
            let n = make(m, body)
            n.position = body.anchor(slot).p
            bodyNode.addChildNode(n)
            addons[slot] = n
        }

        var mounts: [SCNNode] = []
        var spinners: [SCNNode] = []
        let halfTrack = body.track / 2 + (width - body.wheelWidth) / 2
        for x in [body.wheelbase / 2, -body.wheelbase / 2] {
            for side: Float in [1, -1] {
                let mount = SCNNode()
                mount.name = "wheelMount"
                mount.position = V(x, radius, side * halfTrack)
                if side < 0 { mount.eulerAngles.y = .pi }   // hub faces outward on both sides

                let spinner = SCNNode()
                spinner.name = side > 0 ? "spinL" : "spinR"
                let shape = wheel.build(m, CGFloat(radius), CGFloat(width))
                orient(shape, .z)
                spinner.addChildNode(shape)
                mount.addChildNode(spinner)
                root.addChildNode(mount)
                mounts.append(mount)
                spinners.append(spinner)
            }
        }

        let tail = V(body.tail.p.x - 0.1, body.tail.p.y + lift, 0)
        return BuiltCar(root: root, body: bodyNode, wheelMounts: mounts, spinners: spinners,
                        addons: addons, sticker: sticker, driver: driver, tailpipe: tail)
    }
}
