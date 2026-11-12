import SceneKit

/// A car assembled from parts, with handles on the pieces we animate.
struct BuiltCar {
    let root: SCNNode
    let body: SCNNode
    let wheelMounts: [SCNNode]
    let spinners: [SCNNode]
    let topper: SCNNode?
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
        bodyNode.position.y += lift
        root.addChildNode(bodyNode)

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

        var topperNode: SCNNode?
        if let make = topper.build {
            let t = make(m)
            let anchor = topper.spot == .roof ? body.roof : body.rear
            t.position = V(anchor.x, anchor.y + lift, anchor.z)
            root.addChildNode(t)
            topperNode = t
        }

        return BuiltCar(root: root, body: bodyNode, wheelMounts: mounts, spinners: spinners, topper: topperNode)
    }
}
