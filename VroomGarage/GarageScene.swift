import SceneKit
import UIKit

/// The 3D garage: a turntable, lights, the camera, and the car on top.
final class GarageScene {
    let scene = SCNScene()
    let cameraNode = SCNNode()
    let materials = CarMaterials()

    private let cameraRig = SCNNode()
    private let autoSpin = SCNNode()
    private let userSpin = SCNNode()
    private let carHolder = SCNNode()
    private var car: BuiltCar?
    private var resumeSpinWork: DispatchWorkItem?
    private(set) var isDriving = false

    private let minDistance: Float = 8
    private let maxDistance: Float = 16
    var cameraDistance: Float = 11.5 { didSet { cameraNode.position.z = cameraDistance } }

    static let skyTop = UIColor(red: 0.45, green: 0.78, blue: 1.0, alpha: 1)
    static let horizon = UIColor(red: 0.86, green: 0.94, blue: 1.0, alpha: 1)

    init() {
        let sky = verticalGradient(Self.skyTop, Self.horizon)
        scene.background.contents = sky
        scene.lightingEnvironment.contents = sky
        scene.lightingEnvironment.intensity = 1.3
        scene.fogColor = Self.horizon
        scene.fogStartDistance = 20
        scene.fogEndDistance = 55

        // Ground
        let floor = SCNFloor()
        floor.reflectivity = 0.04
        floor.materials = [.pbr(UIColor(red: 0.80, green: 0.90, blue: 0.80, alpha: 1), rough: 0.9)]
        scene.rootNode.addChildNode(SCNNode(geometry: floor))

        // Turntable
        let deck = SCNMaterial.pbr(UIColor(white: 0.97, alpha: 1), rough: 0.4, clearCoat: true)
        let rim = SCNMaterial.pbr(UIColor(red: 1.0, green: 0.78, blue: 0.1, alpha: 1), rough: 0.3, clearCoat: true)
        let table = cylNode(deck, r: 3.6, h: 0.18, at: V(0, -0.09, 0))
        let ring = torusNode(rim, ring: 3.6, pipe: 0.12, at: V(0, -0.02, 0))
        userSpin.addChildNode(table)
        userSpin.addChildNode(ring)
        for i in 0..<12 {
            let a = Float(i) / 12 * 2 * .pi
            let dot = cylNode(rim, r: 0.09, h: 0.02, at: V(cos(a) * 3.2, 0.005, sin(a) * 3.2))
            userSpin.addChildNode(dot)
        }

        scene.rootNode.addChildNode(autoSpin)
        autoSpin.addChildNode(userSpin)
        userSpin.addChildNode(carHolder)
        userSpin.eulerAngles.y = 0.65

        // Lights
        let sun = SCNLight()
        sun.type = .directional
        sun.intensity = 1100
        sun.color = UIColor(red: 1.0, green: 0.97, blue: 0.92, alpha: 1)
        sun.castsShadow = true
        sun.shadowMapSize = CGSize(width: 2048, height: 2048)
        sun.shadowSampleCount = 16
        sun.shadowRadius = 6
        sun.shadowColor = UIColor(white: 0, alpha: 0.38)
        sun.orthographicScale = 7
        sun.shadowMode = .forward
        let sunNode = SCNNode()
        sunNode.light = sun
        sunNode.eulerAngles = V(-1.05, 0.45, 0)
        scene.rootNode.addChildNode(sunNode)

        let fill = SCNLight()
        fill.type = .ambient
        fill.intensity = 280
        fill.color = UIColor(red: 0.85, green: 0.92, blue: 1.0, alpha: 1)
        let fillNode = SCNNode()
        fillNode.light = fill
        scene.rootNode.addChildNode(fillNode)

        // Camera on a rig aimed slightly below the car so the car sits above the parts tray.
        let cam = SCNCamera()
        cam.fieldOfView = 34
        cam.zNear = 0.1
        cam.zFar = 120
        cam.wantsHDR = true
        cam.bloomIntensity = 0.35
        cam.bloomThreshold = 0.9
        cam.bloomBlurRadius = 10
        cam.vignettingIntensity = 0.25
        cam.vignettingPower = 0.6
        cameraNode.camera = cam
        cameraNode.position = V(0, 0, cameraDistance)
        cameraRig.addChildNode(cameraNode)
        cameraRig.position = V(0, 0.15, 0)
        cameraRig.eulerAngles.x = -0.30
        scene.rootNode.addChildNode(cameraRig)

        scene.rootNode.addChildNode(Scenery.make())
        startAutoSpin()
    }

    // MARK: Building

    func apply(_ design: CarDesign, previous: CarDesign?) {
        if previous?.paint != design.paint {
            materials.setPaint(Catalog.paint(design.paint), animated: previous != nil)
        }
        guard let prev = previous else {
            swapCar(design)
            return
        }
        if prev.body != design.body {
            let built = swapCar(design)
            dropIn(built.body, height: 2.6)
            built.wheelMounts.enumerated().forEach { popIn($0.element, delay: 0.25 + Double($0.offset) * 0.06) }
            if let t = built.topper { popIn(t, delay: 0.5) }
            SoundFX.shared.play(.clunk)
        } else if prev.wheels != design.wheels {
            let built = swapCar(design)
            built.wheelMounts.enumerated().forEach { popIn($0.element, delay: Double($0.offset) * 0.08) }
            hop(delay: 0.3)
            SoundFX.shared.play(.boing)
        } else if prev.topper != design.topper {
            let built = swapCar(design)
            if let t = built.topper { popIn(t, delay: 0) }
            hop(delay: 0.15)
            Driver.cheer(built.driver)
            SoundFX.shared.play(.pop)
        } else if prev.paint != design.paint {
            wiggle()
            if let d = car?.driver { Driver.cheer(d) }
            sparkleBurst(color: Catalog.paint(design.paint).color)
            SoundFX.shared.play(.sparkle)
        }
    }

    @discardableResult
    private func swapCar(_ design: CarDesign) -> BuiltCar {
        let built = CarBuilder.build(design, materials: materials)
        car?.root.removeFromParentNode()
        carHolder.addChildNode(built.root)
        car = built
        return built
    }

    func isCar(_ node: SCNNode) -> Bool {
        var n: SCNNode? = node
        while let cur = n {
            if cur === carHolder { return true }
            n = cur.parent
        }
        return false
    }

    // MARK: Little celebrations

    private func popIn(_ node: SCNNode, delay: TimeInterval) {
        node.scale = V(0.01, 0.01, 0.01)
        let grow = SCNAction.scale(to: 1.18, duration: 0.18); grow.timingMode = .easeOut
        let settle = SCNAction.scale(to: 1.0, duration: 0.14); settle.timingMode = .easeInEaseOut
        node.runAction(.sequence([.wait(duration: delay), grow, settle]))
    }

    private func dropIn(_ node: SCNNode, height: Float) {
        let base = node.position
        node.position.y += height
        node.opacity = 0
        let fall = SCNAction.move(to: base, duration: 0.32); fall.timingMode = .easeIn
        node.runAction(.group([fall, .fadeIn(duration: 0.12)])) { [weak self] in self?.squash() }
    }

    private func hop(delay: TimeInterval = 0) {
        let up = SCNAction.moveBy(x: 0, y: 0.45, z: 0, duration: 0.16); up.timingMode = .easeOut
        let down = SCNAction.moveBy(x: 0, y: -0.45, z: 0, duration: 0.16); down.timingMode = .easeIn
        carHolder.runAction(.sequence([.wait(duration: delay), up, down, .run { [weak self] _ in self?.squash() }]), forKey: "hop")
    }

    private func squash() {
        let s1 = SCNAction.customAction(duration: 0.1) { n, t in
            let k = Float(t / 0.1)
            n.scale = V(1 + 0.08 * k, 1 - 0.12 * k, 1 + 0.08 * k)
        }
        let s2 = SCNAction.customAction(duration: 0.22) { n, t in
            let k = Float(t / 0.22)
            let wobble = cos(k * .pi * 2.5) * (1 - k)
            n.scale = V(1 + 0.08 * wobble, 1 - 0.12 * wobble, 1 + 0.08 * wobble)
        }
        carHolder.runAction(.sequence([s1, s2, .scale(to: 1, duration: 0)]), forKey: "squash")
    }

    private func wiggle() {
        let a: CGFloat = 0.12
        carHolder.runAction(.sequence([
            .rotateTo(x: 0, y: 0, z: a, duration: 0.08),
            .rotateTo(x: 0, y: 0, z: -a, duration: 0.12),
            .rotateTo(x: 0, y: 0, z: a * 0.6, duration: 0.1),
            .rotateTo(x: 0, y: 0, z: 0, duration: 0.1),
        ]), forKey: "wiggle")
    }

    private func sparkleBurst(color: UIColor) {
        let ps = SCNParticleSystem()
        ps.particleImage = softDotImage
        ps.birthRate = 400
        ps.emissionDuration = 0.12
        ps.loops = false
        ps.particleLifeSpan = 0.9
        ps.particleLifeSpanVariation = 0.3
        ps.particleVelocity = 4
        ps.particleVelocityVariation = 2
        ps.spreadingAngle = 180
        ps.particleSize = 0.12
        ps.particleSizeVariation = 0.08
        ps.particleColor = color
        ps.particleColorVariation = SCNVector4(0.05, 0.1, 0.2, 0)
        ps.acceleration = V(0, -6, 0)
        ps.blendMode = .additive
        ps.emitterShape = SCNSphere(radius: 1.2)
        let n = SCNNode()
        n.position = V(0, 1.1, 0)
        n.addParticleSystem(ps)
        carHolder.addChildNode(n)
        n.runAction(.sequence([.wait(duration: 1.6), .removeFromParentNode()]))
    }

    // MARK: Actions the kid can trigger

    func honk() {
        SoundFX.shared.play(.honk)
        squash()
        let lights = materials.headlight
        let flash = SCNAction.sequence([
            .run { _ in lights.emission.intensity = 4 }, .wait(duration: 0.15),
            .run { _ in lights.emission.intensity = 1 }, .wait(duration: 0.1),
            .run { _ in lights.emission.intensity = 4 }, .wait(duration: 0.2),
            .run { _ in lights.emission.intensity = 1 },
        ])
        carHolder.runAction(flash, forKey: "flash")
    }

    func vroom() {
        guard !isDriving, let car = car else { return }
        isDriving = true
        SoundFX.shared.play(.vroom)
        let total: TimeInterval = 2.4

        // Spin every wheel. Right-side mounts are flipped, so they spin the other way.
        for s in car.spinners {
            let dir: CGFloat = s.name == "spinL" ? -1 : 1
            let spin = SCNAction.rotateBy(x: 0, y: 0, z: dir * 40, duration: total)
            spin.timingMode = .easeInEaseOut
            s.runAction(spin, forKey: "spin")
        }

        // Rev, zoom off the front of the turntable, come back around from behind.
        let rev = SCNAction.sequence([
            .rotateTo(x: 0, y: 0, z: 0.06, duration: 0.15),
            .rotateTo(x: 0, y: 0, z: 0, duration: 0.15),
        ])
        let out = SCNAction.moveBy(x: 16, y: 0, z: 0, duration: 0.85); out.timingMode = .easeIn
        let back = SCNAction.moveBy(x: 16, y: 0, z: 0, duration: 1.0); back.timingMode = .easeOut
        carHolder.runAction(.sequence([
            rev,
            .run { [weak self] _ in self?.exhaust() },
            out,
            .move(to: V(-16, 0, 0), duration: 0),
            back,
            .run { [weak self] _ in
                DispatchQueue.main.async { self?.isDriving = false; self?.hop() }
            },
        ]), forKey: "drive")
    }

    private func exhaust() {
        let ps = SCNParticleSystem()
        ps.particleImage = softDotImage
        ps.birthRate = 60
        ps.emissionDuration = 0.4
        ps.loops = false
        ps.particleLifeSpan = 0.8
        ps.particleVelocity = 1.5
        ps.spreadingAngle = 25
        ps.particleSize = 0.35
        ps.particleColor = UIColor(white: 0.9, alpha: 0.7)
        ps.acceleration = V(0, 0.8, 0)
        ps.emittingDirection = V(-1, 0.3, 0)
        ps.isAffectedByGravity = false
        let sizeAnim = CAKeyframeAnimation()
        sizeAnim.values = [0.4, 1.6]
        ps.propertyControllers = [.size: SCNParticlePropertyController(animation: sizeAnim)]
        let n = SCNNode()
        let worldPos = carHolder.convertPosition(V(-1.9, 0.5, 0), to: scene.rootNode)
        n.position = worldPos
        n.addParticleSystem(ps)
        scene.rootNode.addChildNode(n)
        n.runAction(.sequence([.wait(duration: 1.6), .removeFromParentNode()]))
    }

    // MARK: Turntable control

    private func startAutoSpin() {
        autoSpin.runAction(.repeatForever(.rotateBy(x: 0, y: CGFloat.pi * 2, z: 0, duration: 26)), forKey: "auto")
    }

    func beginTouch() {
        autoSpin.removeAction(forKey: "auto")
        userSpin.removeAction(forKey: "fling")
        resumeSpinWork?.cancel()
    }

    func endTouch() {
        let work = DispatchWorkItem { [weak self] in self?.startAutoSpin() }
        resumeSpinWork = work
        DispatchQueue.main.asyncAfter(deadline: .now() + 4, execute: work)
    }

    func spin(by dx: CGFloat) {
        userSpin.eulerAngles.y += Float(dx) * 0.011
    }

    func fling(velocity vx: CGFloat) {
        let amount = vx * 0.011 * 0.3
        let a = SCNAction.rotateBy(x: 0, y: amount, z: 0, duration: 0.7)
        a.timingMode = .easeOut
        userSpin.runAction(a, forKey: "fling")
    }

    func zoom(to distance: Float) {
        cameraDistance = min(max(distance, minDistance), maxDistance)
    }
}
