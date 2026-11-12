import SceneKit
import SwiftUI

/// Hosts the SceneKit garage and turns finger gestures into turntable spins and zoom.
struct GarageSceneView: UIViewRepresentable {
    let garage: GarageModel

    func makeCoordinator() -> Coordinator { Coordinator(garage: garage) }

    func makeUIView(context: Context) -> SCNView {
        let view = SCNView(frame: .zero, options: nil)
        view.scene = garage.scene.scene
        view.pointOfView = garage.scene.cameraNode
        view.antialiasingMode = .multisampling4X
        view.preferredFramesPerSecond = 60
        view.rendersContinuously = true
        view.backgroundColor = GarageScene.horizon
        view.isMultipleTouchEnabled = true

        let c = context.coordinator
        let pan = UIPanGestureRecognizer(target: c, action: #selector(Coordinator.pan(_:)))
        pan.maximumNumberOfTouches = 1
        let pinch = UIPinchGestureRecognizer(target: c, action: #selector(Coordinator.pinch(_:)))
        let tap = UITapGestureRecognizer(target: c, action: #selector(Coordinator.tap(_:)))
        [pan, pinch, tap].forEach {
            $0.delegate = c
            view.addGestureRecognizer($0)
        }
        return view
    }

    func updateUIView(_ uiView: SCNView, context: Context) {}

    final class Coordinator: NSObject, UIGestureRecognizerDelegate {
        let garage: GarageModel
        private var pinchStart: Float = 0
        private var lastX: CGFloat = 0

        init(garage: GarageModel) { self.garage = garage }

        @objc func pan(_ g: UIPanGestureRecognizer) {
            let scene = garage.scene
            switch g.state {
            case .began:
                scene.beginTouch()
                lastX = g.translation(in: g.view).x
            case .changed:
                let x = g.translation(in: g.view).x
                scene.spin(by: x - lastX)
                lastX = x
            case .ended, .cancelled, .failed:
                scene.fling(velocity: g.velocity(in: g.view).x)
                scene.endTouch()
            default: break
            }
        }

        @objc func pinch(_ g: UIPinchGestureRecognizer) {
            let scene = garage.scene
            switch g.state {
            case .began:
                scene.beginTouch()
                pinchStart = scene.cameraDistance
            case .changed:
                scene.zoom(to: pinchStart / Float(max(g.scale, 0.1)))
            case .ended, .cancelled, .failed:
                scene.endTouch()
            default: break
            }
        }

        @objc func tap(_ g: UITapGestureRecognizer) {
            guard let view = g.view as? SCNView else { return }
            let hits = view.hitTest(g.location(in: view), options: [.searchMode: SCNHitTestSearchMode.all.rawValue])
            if hits.contains(where: { garage.scene.isCar($0.node) }) {
                garage.honk()
            }
        }

        func gestureRecognizer(_ g: UIGestureRecognizer, shouldRecognizeSimultaneouslyWith other: UIGestureRecognizer) -> Bool {
            true
        }
    }
}
