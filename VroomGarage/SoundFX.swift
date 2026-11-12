import AVFoundation

/// Every sound in the app is synthesized at launch, so there are no audio files to ship.
final class SoundFX {
    enum Effect: CaseIterable { case pop, click, honk, vroom, sparkle, boing, clunk }

    static let shared = SoundFX()

    private let engine = AVAudioEngine()
    private var players: [AVAudioPlayerNode] = []
    private var buffers: [Effect: AVAudioPCMBuffer] = [:]
    private var nextPlayer = 0
    private let sampleRate: Double = 44_100
    private let format: AVAudioFormat

    private init() {
        format = AVAudioFormat(standardFormatWithSampleRate: sampleRate, channels: 1)!
        try? AVAudioSession.sharedInstance().setCategory(.playback, options: [.mixWithOthers])
        try? AVAudioSession.sharedInstance().setActive(true)
        for _ in 0..<8 {
            let p = AVAudioPlayerNode()
            engine.attach(p)
            engine.connect(p, to: engine.mainMixerNode, format: format)
            players.append(p)
        }
        engine.mainMixerNode.outputVolume = 0.85
        for e in Effect.allCases { buffers[e] = synth(e) }
        try? engine.start()
    }

    func warmUp() { _ = buffers.count }

    func play(_ effect: Effect) {
        guard let buffer = buffers[effect] else { return }
        if !engine.isRunning { try? engine.start() }
        guard engine.isRunning else { return }
        let p = players[nextPlayer]
        nextPlayer = (nextPlayer + 1) % players.count
        p.stop()
        p.scheduleBuffer(buffer, at: nil, options: [], completionHandler: nil)
        p.play()
    }

    // MARK: Synthesis

    private func make(_ seconds: Double, _ fill: (UnsafeMutablePointer<Float>, Int, Double) -> Void) -> AVAudioPCMBuffer? {
        let n = AVAudioFrameCount(seconds * sampleRate)
        guard let b = AVAudioPCMBuffer(pcmFormat: format, frameCapacity: n) else { return nil }
        b.frameLength = n
        fill(b.floatChannelData![0], Int(n), sampleRate)
        return b
    }

    private func synth(_ e: Effect) -> AVAudioPCMBuffer? {
        let twoPi = 2.0 * Double.pi
        switch e {
        case .pop:
            return make(0.16) { out, n, sr in
                var ph = 0.0
                for i in 0..<n {
                    let t = Double(i) / sr
                    let f = 320.0 * pow(3.5, t / 0.16)
                    ph += twoPi * f / sr
                    let env = min(1, t / 0.004) * exp(-t * 26)
                    out[i] = Float(sin(ph) * env * 0.6)
                }
            }
        case .click:
            return make(0.06) { out, n, sr in
                for i in 0..<n {
                    let t = Double(i) / sr
                    out[i] = Float(sin(twoPi * 1400 * t) * exp(-t * 80) * 0.4)
                }
            }
        case .sparkle:
            let notes: [(Double, Double)] = [(0, 1046.5), (0.07, 1318.5), (0.14, 1568.0), (0.21, 2093.0)]
            return make(0.75) { out, n, sr in
                for i in 0..<n {
                    let t = Double(i) / sr
                    var s = 0.0
                    for (t0, f) in notes where t >= t0 {
                        let dt = t - t0
                        s += (sin(twoPi * f * dt) + 0.3 * sin(twoPi * f * 2 * dt)) * exp(-dt * 9) * min(1, dt / 0.003)
                    }
                    out[i] = Float(s * 0.22)
                }
            }
        case .boing:
            return make(0.45) { out, n, sr in
                var ph = 0.0
                for i in 0..<n {
                    let t = Double(i) / sr
                    let f = 260.0 * (1 + 0.55 * sin(twoPi * 11 * t) * exp(-t * 5)) * (1 - 0.3 * t)
                    ph += twoPi * f / sr
                    out[i] = Float(sin(ph) * exp(-t * 6) * min(1, t / 0.005) * 0.55)
                }
            }
        case .clunk:
            return make(0.35) { out, n, sr in
                var ph = 0.0
                var noise: UInt32 = 12345
                for i in 0..<n {
                    let t = Double(i) / sr
                    let f = 140.0 * exp(-t * 3)
                    ph += twoPi * f / sr
                    noise = noise &* 1664525 &+ 1013904223
                    let nz = Double(noise) / Double(UInt32.max) * 2 - 1
                    let thud = sin(ph) * exp(-t * 14)
                    let clack = nz * exp(-t * 60) * 0.5
                    out[i] = Float((thud + clack) * 0.7)
                }
            }
        case .honk:
            return make(0.62) { out, n, sr in
                for i in 0..<n {
                    let t = Double(i) / sr
                    // "beep-beeeep"
                    let on: Double
                    if t < 0.17 { on = min(1, t / 0.01) * min(1, (0.17 - t) / 0.02) }
                    else if t > 0.24 && t < 0.6 { on = min(1, (t - 0.24) / 0.01) * min(1, (0.6 - t) / 0.04) }
                    else { on = 0 }
                    let raw = sin(twoPi * 392 * t) + 0.8 * sin(twoPi * 494 * t) + 0.3 * sin(twoPi * 784 * t)
                    out[i] = Float(tanh(raw * 2.2) * on * 0.32)
                }
            }
        case .vroom:
            return make(4.7) { out, n, sr in
                var ph = 0.0
                var sub = 0.0
                var y = 0.0
                var noise: UInt32 = 987
                for i in 0..<n {
                    let t = Double(i) / sr
                    let f: Double
                    if t < 0.3 { f = 55 + 150 * (t / 0.3) }                          // rev
                    else if t < 0.5 { f = 205 - 80 * ((t - 0.3) / 0.2) }               // clutch
                    else if t < 1.3 { f = 125 + 110 * ((t - 0.5) / 0.8) }              // go!
                    else if t < 3.7 { f = 235 + 14 * sin(twoPi * 1.3 * t) }            // cruising the lap
                    else { f = 235 - 165 * min(1, (t - 3.7) / 0.9) }                   // slow down
                    ph += f / sr
                    sub += f * 0.5 / sr
                    let saw = 2 * (ph - floor(ph)) - 1
                    let subSaw = 2 * (sub - floor(sub)) - 1
                    noise = noise &* 1664525 &+ 1013904223
                    let nz = Double(noise) / Double(UInt32.max) * 2 - 1
                    let x = saw * 0.5 + subSaw * 0.4 + nz * 0.12
                    y += 0.22 * (x - y)
                    let env = min(1, t / 0.04) * (t > 4.2 ? max(0, (4.7 - t) / 0.5) : 1)
                    out[i] = Float(tanh(y * 1.8) * env * 0.5)
                }
            }
        }
    }
}
