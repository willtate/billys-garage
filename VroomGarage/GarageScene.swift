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
    var cameraDistance: Float = 10 { didSet { cameraNode.position.z = cameraDistance } }

    static let backdrop = UIColor(white: 0.12, alpha: 1)

    init() {
        scene.background.contents = Self.backdrop
        scene.lightingEnvironment.contents = studioEnvironment
        scene.lightingEnvironment.intensity = 1.25

        // Polished concrete floor
        let floor = SCNFloor()
        floor.reflectivity = 0.12
        floor.reflectionFalloffEnd = 3
        let concrete = Workshop.textured(concreteImage, repeatX: 14, repeatY: 14, rough: 0.5)
        concrete.diffuse.contentsTransform = SCNMatrix4MakeScale(0.12, 0.12, 1)
        concrete.diffuse.intensity = 0.9
        floor.materials = [concrete]
        let floorNode = SCNNode(geometry: floor)
        floorNode.position.y = Workshop.floorY
        scene.rootNode.addChildNode(floorNode)

        // Turntable: diamond-plate deck with a glowing ring
        let deck = Workshop.textured(diamondPlateImage, repeatX: 9, repeatY: 9, rough: 0.35)
        deck.metalness.contents = 0.8
        let edge = SCNMaterial.pbr(UIColor(white: 0.2, alpha: 1), metal: 0.9, rough: 0.3)
        let led = SCNMaterial.pbr(UIColor(red: 0.6, green: 0.9, blue: 1.0, alpha: 1), rough: 0.2,
                                  emission: UIColor(red: 0.35, green: 0.8, blue: 1.0, alpha: 1))
        let table = SCNCylinder(radius: 3.6, height: 0.25)
        table.radialSegmentCount = 72
        table.materials = [edge, deck, edge]
        let tableNode = SCNNode(geometry: table)
        tableNode.position = V(0, -0.125, 0)
        userSpin.addChildNode(tableNode)
        userSpin.addChildNode(torusNode(led, ring: 3.6, pipe: 0.04, at: V(0, -0.02, 0)))
        userSpin.addChildNode(torusNode(edge, ring: 3.62, pipe: 0.06, at: V(0, -0.15, 0)))
        for i in 0..<16 {
            let a = Float(i) / 16 * 2 * .pi
            userSpin.addChildNode(cylNode(led, r: 0.05, h: 0.01, at: V(cos(a) * 3.3, 0.002, sin(a) * 3.3)))
        }

        scene.rootNode.addChildNode(autoSpin)
        autoSpin.addChildNode(userSpin)
        userSpin.addChildNode(carHolder)
        userSpin.eulerAngles.y = -0.7

        // Lights: a key light from the roof with soft shadows, two cooler rim lights and warm fill.
        let key = SCNLight()
        key.type = .directional
        key.intensity = 1150
        key.color = UIColor(red: 1.0, green: 0.97, blue: 0.92, alpha: 1)
        key.castsShadow = true
        key.shadowMapSize = CGSize(width: 2048, height: 2048)
        key.shadowSampleCount = 16
        key.shadowRadius = 8
        key.shadowColor = UIColor(white: 0, alpha: 0.55)
        key.orthographicScale = 8
        key.shadowMode = .forward
        let keyNode = SCNNode()
        keyNode.light = key
        keyNode.eulerAngles = V(-1.2, 0.35, 0)
        scene.rootNode.addChildNode(keyNode)

        for (x, z) in [(Float(-7), Float(-4)), (Float(7), Float(-5))] {
            let rim = SCNLight()
            rim.type = .omni
            rim.intensity = 420
            rim.color = UIColor(red: 0.8, green: 0.9, blue: 1.0, alpha: 1)
            rim.attenuationStartDistance = 4
            rim.attenuationEndDistance = 18
            let n = SCNNode()
            n.light = rim
            n.position = V(x, 5, z)
            scene.rootNode.addChildNode(n)
        }

        let fill = SCNLight()
        fill.type = .ambient
        fill.intensity = 300
        fill.color = UIColor(red: 1.0, green: 0.95, blue: 0.88, alpha: 1)
        let fillNode = SCNNode()
        fillNode.light = fill
        scene.rootNode.addChildNode(fillNode)

        // Camera on a rig aimed slightly below the car so the car sits above the parts tray.
        let cam = SCNCamera()
        cam.fieldOfView = 34
        cam.zNear = 0.1
        cam.zFar = 120
        cam.wantsHDR = false
        cam.bloomIntensity = 0.35
        cam.bloomThreshold = 0.9
        cam.bloomBlurRadius = 10
        cam.vignettingIntensity = 0.25
        cam.vignettingPower = 0.6
        cameraNode.camera = cam
        cameraNode.position = V(0, 0, cameraDistance)
        cameraRig.addChildNode(cameraNode)
        cameraRig.position = V(0, 0.55, 0)
        cameraRig.eulerAngles.x = -0.2
        scene.rootNode.addChildNode(cameraRig)

        scene.rootNode.addChildNode(Workshop.make())
        captureGarageReflections()
        startAutoSpin()
    }

    /// Photograph the workshop in six directions from where the car sits and use that as the
    /// environment, so paint, chrome and glass reflect the real garage instead of a generic studio.
    private func captureGarageReflections() {
        let size: CGFloat = 256
        let r = SCNRenderer(device: MTLCreateSystemDefaultDevice(), options: nil)
        r.scene = scene
        let cam = SCNCamera()
        cam.fieldOfView = 90
        cam.zNear = 0.05
        cam.zFar = 120
        let eye = SCNNode()
        eye.camera = cam
        eye.position = V(0, 1.0, 0)
        scene.rootNode.addChildNode(eye)
        r.pointOfView = eye
        carHolder.isHidden = true
        func shot(_ dir: SCNVector3, up: SCNVector3) -> UIImage {
            eye.look(at: V(dir.x, 1.0 + dir.y, dir.z), up: up, localFront: V(0, 0, -1))
            return r.snapshot(atTime: 0, with: CGSize(width: size, height: size), antialiasingMode: .none)
        }
        let px = shot(V(1, 0, 0), up: V(0, 1, 0))
        let nx = shot(V(-1, 0, 0), up: V(0, 1, 0))
        let ny = shot(V(0, -1, 0), up: V(0, 0, 1))
        let pz = shot(V(0, 0, 1), up: V(0, 1, 0))
        let nz = shot(V(0, 0, -1), up: V(0, 1, 0))
        carHolder.isHidden = false
        eye.removeFromParentNode()
        // Showroom contrast: a row of shop lights just above the horizon and a darker floor,
        // so the flanks carry the bright reflected horizon line real paint shows.
        func stage(_ img: UIImage, floor: Bool = false) -> UIImage {
            let fmt = UIGraphicsImageRendererFormat(); fmt.scale = 1
            return UIGraphicsImageRenderer(size: CGSize(width: size, height: size), format: fmt).image { ctx in
                let c = ctx.cgContext, w = size, h = size
                img.draw(in: CGRect(x: 0, y: 0, width: w, height: h))
                if floor { return }
                c.setFillColor(UIColor(white: 0, alpha: 0.45).cgColor)
                c.fill(CGRect(x: 0, y: h * 0.52, width: w, height: h * 0.48))
                c.setFillColor(UIColor.white.cgColor)
                c.fill(CGRect(x: 0, y: h * 0.38, width: w, height: h * 0.05))
                c.setFillColor(UIColor(white: 1, alpha: 0.5).cgColor)
                c.fill(CGRect(x: 0, y: h * 0.2, width: w, height: h * 0.025))
            }
        }
        let cube: [UIImage] = [stage(px), stage(nx), Self.workshopCeiling, stage(ny, floor: true), stage(pz), stage(nz)]
        scene.lightingEnvironment.contents = cube
        scene.lightingEnvironment.intensity = 0.85
        for mat in [materials.glass, materials.lens, materials.tailLens] { mat.reflective.contents = cube }
        materials.glass.reflective.intensity = 0.55
    }

    /// Dark ceiling with long fluorescent panels: gives the hood and roof crisp highlight streaks.
    static let workshopCeiling: UIImage = {
        let s: CGFloat = 256
        let fmt = UIGraphicsImageRendererFormat(); fmt.scale = 1
        return UIGraphicsImageRenderer(size: CGSize(width: s, height: s), format: fmt).image { ctx in
            let c = ctx.cgContext
            c.setFillColor(UIColor(white: 0.14, alpha: 1).cgColor)
            c.fill(CGRect(x: 0, y: 0, width: s, height: s))
            c.setFillColor(UIColor(white: 1, alpha: 1).cgColor)
            for x: CGFloat in [52, 120, 188] {
                c.fill(CGRect(x: x, y: 20, width: 16, height: s - 40))
            }
        }
    }()

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
            SoundFX.shared.play(.clunk)
        } else if prev.wheels != design.wheels {
            let built = swapCar(design)
            built.wheelMounts.enumerated().forEach { popIn($0.element, delay: Double($0.offset) * 0.08) }
            hop(delay: 0.3)
            SoundFX.shared.play(.boing)
        } else if let slot = AddonSlot.allCases.first(where: { prev.addon($0) != design.addon($0) }) {
            let built = swapCar(design)
            if let n = built.addons[slot] { popIn(n, delay: 0) }
            hop(delay: 0.15)
            Driver.cheer(built.driver)
            SoundFX.shared.play(design.addon(slot) == "none" ? .click : .clunk)
        } else if prev.sticker != design.sticker {
            let built = swapCar(design)
            if let s = built.sticker { popIn(s, delay: 0) }
            wiggle()
            Driver.cheer(built.driver)
            sparkleBurst(color: .white)
            SoundFX.shared.play(.sparkle)
        } else if prev.paint != design.paint {
            // Stickers pick their ink colour from the paint, so rebuild them.
            swapCar(design)
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
        Driver.lookAt(built.driver, camera: cameraNode)
        car = built
        frameCar(built)
        return built
    }

    /// Pull the camera back for big cars, in for small ones.
    private func frameCar(_ built: BuiltCar) {
        guard let (lo, hi) = built.root.deepBounds() else { return }
        let len = hi.x - lo.x, height = hi.y - lo.y
        let target = min(max(max(len * 2.25, height * 4.2), minDistance), maxDistance)
        SCNTransaction.begin()
        SCNTransaction.animationDuration = 0.6
        cameraDistance = target
        SCNTransaction.commit()
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

    static let roadRadius: Float = 5.8
    private let lapTime: TimeInterval = 4.2

    func vroom() {
        guard !isDriving, let car = car else { return }
        isDriving = true
        SoundFX.shared.play(.vroom)

        // Spin every wheel. Right-side mounts are flipped, so they spin the other way.
        for s in car.spinners {
            let dir: CGFloat = s.name == "spinL" ? -1 : 1
            let spin = SCNAction.rotateBy(x: 0, y: 0, z: dir * 90, duration: lapTime + 0.3)
            spin.timingMode = .easeInEaseOut
            s.runAction(spin, forKey: "spin")
        }

        // Rev, drive off the turntable onto the road, do a lap, come home and spin round.
        let rev = SCNAction.sequence([
            .rotateTo(x: 0, y: 0, z: 0.06, duration: 0.15),
            .rotateTo(x: 0, y: 0, z: 0, duration: 0.15),
        ])
        let R = Self.roadRadius
        let total = R * 2 + 2 * .pi * R
        let lapDuration = lapTime
        let lap = SCNAction.customAction(duration: lapDuration) { node, elapsed in
            let u = Float(elapsed / CGFloat(lapDuration))
            let eased = u * u * (3 - 2 * u)
            let s = eased * total
            var x: Float, z: Float, yaw: Float
            if s < R {
                x = s; z = 0
                yaw = (.pi / 2) * smooth01((s - 0.55 * R) / (0.45 * R))
            } else if s < R + 2 * .pi * R {
                let th = (s - R) / R
                x = R * cos(th); z = -R * sin(th)
                yaw = th + .pi / 2
            } else {
                let d = s - R - 2 * .pi * R
                x = R - d; z = 0
                yaw = 2 * .pi + .pi / 2 + (.pi / 2) * smooth01(d / (0.45 * R))
            }
            let r = (x * x + z * z).squareRoot()
            let y = -0.25 * smooth01((r - 3.4) / 0.5)
            node.position = V(x, y, z)
            node.eulerAngles = V(0, yaw, 0)
        }
        // Lift the camera so the whole lap stays above the parts tray, then glide back.
        let restDistance = cameraDistance
        let lift = SCNAction.customAction(duration: lapDuration + 0.3) { [weak self] _, elapsed in
            guard let self = self else { return }
            let u = Float(elapsed) / Float(lapDuration + 0.3)
            let k = smooth01(u / 0.15) * (1 - smooth01((u - 0.85) / 0.15))
            self.cameraRig.eulerAngles.x = -0.2 + (-0.42 * k)
            self.cameraRig.position = V(0, 0.55, 3.0 * k)
            self.cameraNode.position.z = restDistance + (19 - restDistance) * k
        }
        cameraRig.runAction(.sequence([.wait(duration: 0.3), lift, .run { [weak self] rig in
            rig.eulerAngles.x = -0.2
            rig.position = V(0, 0.55, 0)
            self?.cameraNode.position.z = restDistance
        }]), forKey: "lift")

        let spinHome = SCNAction.rotateBy(x: 0, y: .pi, z: 0, duration: 0.45)
        spinHome.timingMode = .easeOut
        carHolder.runAction(.sequence([
            rev,
            .run { [weak self] _ in self?.exhaust() },
            lap,
            spinHome,
            .run { [weak self] node in
                node.eulerAngles = V(0, 0, 0)
                node.position = V(0, 0, 0)
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
        let worldPos = carHolder.convertPosition(car?.tailpipe ?? V(-1.9, 0.5, 0), to: scene.rootNode)
        ps.emittingDirection = carHolder.convertVector(V(-1, 0.3, 0), to: scene.rootNode)
        n.position = worldPos
        n.addParticleSystem(ps)
        scene.rootNode.addChildNode(n)
        n.runAction(.sequence([.wait(duration: 1.6), .removeFromParentNode()]))
    }

    // MARK: Turntable control

    private func startAutoSpin() {
        // Gently sway around a three-quarter front view so the driver and headlights face the kid.
        let left = SCNAction.rotateTo(x: 0, y: 0.22, z: 0, duration: 4.5, usesShortestUnitArc: true)
        let right = SCNAction.rotateTo(x: 0, y: -0.28, z: 0, duration: 4.5, usesShortestUnitArc: true)
        left.timingMode = .easeInEaseOut
        right.timingMode = .easeInEaseOut
        let sway = SCNAction.sequence([left, right])
        autoSpin.runAction(.repeatForever(sway), forKey: "auto")
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
        guard !isDriving else { return }
        cameraDistance = min(max(distance, minDistance), maxDistance)
    }
}

@inline(__always) func smooth01(_ x: Float) -> Float {
    let t = min(max(x, 0), 1)
    return t * t * (3 - 2 * t)
}
