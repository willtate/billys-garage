import SceneKit
import UIKit

/// A car assembled from parts, with handles on the pieces we animate.
struct BuiltCar {
    let root: SCNNode
    let body: SCNNode
    let wheelMounts: [SCNNode]
    let spinners: [SCNNode]
    let topper: SCNNode?
    let driver: SCNNode
}

enum CarBuilder {
    static let baseWheelRadius: Float = 0.42

    static func build(_ design: CarDesign, materials m: CarMaterials) -> BuiltCar {
        let body = Catalog.body(design.body)
        let wheel = Catalog.wheel(design.wheels)
        let topper = Catalog.topper(design.topper)

        // Wheels are sized relative to the body, then scaled by the wheel style.
        let radius = body.wheelRadius * wheel.scale
        let width = body.wheelWidth * wheel.widthScale
        let lift = radius - body.wheelRadius   // bigger wheels raise the whole body

        let root = SCNNode()
        root.name = "car"

        let bodyNode = body.build(m)
        Details.decorate(body.id, bodyNode, m)
        bodyNode.position.y += lift
        root.addChildNode(bodyNode)

        let driver = Driver.make(m)
        driver.position = V(body.seat.x, body.seat.y, body.seat.z)
        driver.scale = V(body.driverScale, body.driverScale, body.driverScale)
        bodyNode.addChildNode(driver)

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

                // Fender arch hugging the top of the wheel
                if body.sideZ > 0 && wheel.scale <= 1.1 {
                    let outer = CGFloat(radius) + 0.15, inner = CGFloat(radius) + 0.04
                    let arc = UIBezierPath(arcCenter: .zero, radius: outer, startAngle: 0, endAngle: .pi, clockwise: true)
                    arc.addArc(withCenter: .zero, radius: inner, startAngle: .pi, endAngle: 0, clockwise: false)
                    arc.close()
                    arc.flatness = 0.004
                    let shape = SCNShape(path: arc, extrusionDepth: 0.12)
                    shape.chamferRadius = 0.03
                    shape.materials = [m.paint]
                    let arch = SCNNode(geometry: shape)
                    arch.position = V(x, radius, side * (body.sideZ + 0.03))
                    root.addChildNode(arch)
                }
                spinners.append(spinner)
            }
        }

        var topperNode: SCNNode?
        if let make = topper.build {
            let t = make(m)
            let anchor: SCNVector3
            switch topper.spot {
            case .roof: anchor = body.roof
            case .rear: anchor = body.rear
            case .hood: anchor = body.hood
            }
            t.position = V(anchor.x, anchor.y + lift, anchor.z)
            root.addChildNode(t)
            topperNode = t
        }

        return BuiltCar(root: root, body: bodyNode, wheelMounts: mounts, spinners: spinners, topper: topperNode, driver: driver)
    }
}
