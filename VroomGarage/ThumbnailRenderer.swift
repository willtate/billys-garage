import SceneKit
import UIKit

/// Renders little 3D pictures of parts for the picker cards, off-screen.
final class ThumbnailRenderer {
    private let renderer: SCNRenderer
    private let scene = SCNScene()
    private let stage = SCNNode()
    private let camera = SCNNode()
    let materials = CarMaterials()

    init() {
        renderer = SCNRenderer(device: MTLCreateSystemDefaultDevice(), options: nil)
        renderer.scene = scene
        scene.background.contents = UIColor.clear
        scene.lightingEnvironment.contents = verticalGradient(GarageScene.skyTop, GarageScene.horizon)
        scene.lightingEnvironment.intensity = 1.4

        let key = SCNLight(); key.type = .directional; key.intensity = 1200
        let keyNode = SCNNode(); keyNode.light = key; keyNode.eulerAngles = V(-0.9, 0.6, 0)
        scene.rootNode.addChildNode(keyNode)
        let amb = SCNLight(); amb.type = .ambient; amb.intensity = 350
        let ambNode = SCNNode(); ambNode.light = amb
        scene.rootNode.addChildNode(ambNode)

        let cam = SCNCamera(); cam.fieldOfView = 30; cam.zNear = 0.05; cam.zFar = 100
        camera.camera = cam
        scene.rootNode.addChildNode(camera)
        scene.rootNode.addChildNode(stage)
        renderer.pointOfView = camera
    }

    func car(_ design: CarDesign, size: CGFloat) -> UIImage {
        materials.setPaint(Catalog.paint(design.paint), animated: false)
        let built = CarBuilder.build(design, materials: materials)
        return shoot(built.root, size: size, direction: V(0.78, 0.42, 0.95))
    }

    func wheel(_ id: String, paint: String, size: CGFloat) -> UIImage {
        materials.setPaint(Catalog.paint(paint), animated: false)
        let node = Catalog.wheel(id).build(materials, 0.42, 0.36)
        orient(node, .z)
        let holder = group(nil, [node])
        return shoot(holder, size: size, direction: V(0.45, 0.25, 1.0))
    }

    func topper(_ id: String, paint: String, size: CGFloat) -> UIImage? {
        guard let make = Catalog.topper(id).build else { return nil }
        materials.setPaint(Catalog.paint(paint), animated: false)
        let node = make(materials)
        return shoot(group(nil, [node]), size: size, direction: V(0.9, 0.55, 0.85))
    }

    private func shoot(_ node: SCNNode, size: CGFloat, direction: SCNVector3) -> UIImage {
        stage.childNodes.forEach { $0.removeFromParentNode() }
        stage.addChildNode(node)
        guard let (lo, hi) = node.deepBounds() else { return UIImage() }
        let center = V((lo.x + hi.x) / 2, (lo.y + hi.y) / 2, (lo.z + hi.z) / 2)
        let dx = hi.x - lo.x, dy = hi.y - lo.y, dz = hi.z - lo.z
        let radius = sqrt(dx * dx + dy * dy + dz * dz) / 2
        let len = sqrt(direction.x * direction.x + direction.y * direction.y + direction.z * direction.z)
        let dir = V(direction.x / len, direction.y / len, direction.z / len)
        let fov = Float(camera.camera!.fieldOfView) * .pi / 180
        let dist = radius / sin(fov / 2) * 0.78
        camera.position = V(center.x + dir.x * dist, center.y + dir.y * dist, center.z + dir.z * dist)
        camera.look(at: center)
        let scale = UIScreen.main.scale
        let img = renderer.snapshot(atTime: 0, with: CGSize(width: size * scale, height: size * scale), antialiasingMode: .multisampling4X)
        stage.childNodes.forEach { $0.removeFromParentNode() }
        return UIImage(cgImage: img.cgImage!, scale: scale, orientation: .up)
    }
}
