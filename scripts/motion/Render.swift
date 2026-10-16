// Native, deterministic SceneKit renderer for ScopeMatch's intro and closing.
// Media tooling only: no dependency on the app or access to its data/credentials.
import AppKit
import SceneKit
import Metal
import AVFoundation
import CoreVideo

let width = 1920, height = 1080, fps = 30
func clamp(_ x: Double) -> Double { min(1, max(0, x)) }
func ease(_ x: Double) -> Double { let t = clamp(x); return t * t * (3 - 2 * t) }
func phase(_ t: Double, _ a: Double, _ b: Double) -> Double { ease((t - a) / (b - a)) }
func mix(_ a: Double, _ b: Double, _ t: Double) -> Double { a + (b - a) * t }
func vec(_ x: Double, _ y: Double, _ z: Double) -> SIMD3<Float> { SIMD3(Float(x), Float(y), Float(z)) }
func color(_ hex: Int) -> NSColor {
    NSColor(srgbRed: CGFloat((hex >> 16) & 255) / 255, green: CGFloat((hex >> 8) & 255) / 255, blue: CGFloat(hex & 255) / 255, alpha: 1)
}
let paper = color(0xf4efe4), card = color(0xfbf8f1), ink = color(0x1b1a17)
let blue = color(0x233f94), red = color(0xd9472b), rule = color(0xd6ccb8)
func serif(_ size: CGFloat, italic: Bool = false) -> NSFont {
    NSFont(name: italic ? "IowanOldStyle-Italic" : "IowanOldStyle-Roman", size: size)
        ?? NSFont(name: italic ? "Georgia-Italic" : "Georgia", size: size)!
}
func sans(_ size: CGFloat) -> NSFont { NSFont.systemFont(ofSize: size, weight: .regular) }
func mono(_ size: CGFloat) -> NSFont { NSFont.monospacedSystemFont(ofSize: size, weight: .regular) }
func text(_ s: String, _ font: NSFont, _ c: NSColor, at p: NSPoint, spacing: CGFloat = 0) {
    (s as NSString).draw(at: p, withAttributes: [.font: font, .foregroundColor: c, .kern: spacing])
}
func line(_ from: NSPoint, _ to: NSPoint, _ c: NSColor, _ width: CGFloat = 1) {
    c.setStroke(); let p = NSBezierPath(); p.lineWidth = width; p.move(to: from); p.line(to: to); p.stroke()
}
func fill(_ r: NSRect, _ c: NSColor) { c.setFill(); r.fill() }

// Paper textures are original vector drawing, typeset with a macOS fallback
// already listed in the app's design tokens. No stock images or logos.
func texture(kind: String, accent: NSColor = blue, agreed: Bool = false) -> NSImage {
    let image = NSImage(size: NSSize(width: 720, height: 960))
    image.lockFocus()
    fill(NSRect(x: 0, y: 0, width: 720, height: 960), card)
    // A subtle, reproducible fibre grain. Kept quiet enough to read as paper.
    var seed: UInt64 = 2387
    for _ in 0..<16000 {
        seed = seed &* 6364136223846793005 &+ 1
        let x = CGFloat((seed >> 24) % 72000) / 100
        seed = seed &* 6364136223846793005 &+ 1
        let y = CGFloat((seed >> 24) % 96000) / 100
        fill(NSRect(x: x, y: y, width: 0.7, height: 0.7), ink.withAlphaComponent(0.045))
    }
    if kind == "sealed" {
        fill(NSRect(x: 0, y: 0, width: 720, height: 960), accent.withAlphaComponent(0.94))
        for y in stride(from: 80, to: 920, by: 22) {
            line(NSPoint(x: 70, y: y), NSPoint(x: 650, y: y), paper.withAlphaComponent(0.08))
        }
        text("§", serif(360), paper, at: NSPoint(x: 242, y: 330))
        text("SEALED", mono(24), paper, at: NSPoint(x: 285, y: 200), spacing: 5)
        line(NSPoint(x: 70, y: 126), NSPoint(x: 650, y: 126), paper.withAlphaComponent(0.5))
        text("INDEPENDENT ANSWERS", mono(16), paper, at: NSPoint(x: 70, y: 80), spacing: 3)
    } else if kind == "answer" {
        fill(NSRect(x: 0, y: 945, width: 720, height: 15), accent)
        text(accent == blue ? "01 / FREELANCER" : "02 / CLIENT", mono(22), accent, at: NSPoint(x: 58, y: 870), spacing: 2)
        line(NSPoint(x: 58, y: 835), NSPoint(x: 662, y: 835), rule, 1.5)
        text(accent == blue ? "A" : "C", serif(245), accent, at: NSPoint(x: 65, y: 485))
        text(accent == blue ? "Open WhatsApp" : "Reserve immediately", serif(42), ink, at: NSPoint(x: 64, y: 420))
        for (i, length) in [530, 455, 510, 310].enumerated() {
            fill(NSRect(x: 64, y: 340 - i * 44, width: length, height: 4), rule.withAlphaComponent(0.7))
        }
        text("ONE BRIEF", mono(17), accent, at: NSPoint(x: 64, y: 105), spacing: 3)
        text("TWO INTERPRETATIONS", mono(17), accent, at: NSPoint(x: 64, y: 72), spacing: 3)
    } else {
        text("§ ScopeMatch", serif(38), ink, at: NSPoint(x: 54, y: 868))
        line(NSPoint(x: 54, y: 843), NSPoint(x: 666, y: 843), ink, 1.5)
        text("THE AGREED SCOPE", mono(19), ink, at: NSPoint(x: 54, y: 788), spacing: 2)
        text("One scope.", serif(75), ink, at: NSPoint(x: 54, y: 660))
        for (i, length) in [520, 460, 540, 350, 510, 390].enumerated() {
            fill(NSRect(x: 54, y: 607 - i * 36, width: length, height: 4), rule)
        }
        if agreed {
            NSGraphicsContext.saveGraphicsState()
            let transform = NSAffineTransform(); transform.translateX(by: 356, yBy: 365); transform.rotate(byDegrees: -8); transform.concat()
            ink.setStroke()
            let outer = NSBezierPath(rect: NSRect(x: -262, y: -71, width: 524, height: 142)); outer.lineWidth = 7; outer.stroke()
            let inner = NSBezierPath(rect: NSRect(x: -248, y: -57, width: 496, height: 114)); inner.lineWidth = 2; inner.stroke()
            text("AGREED", mono(78), ink, at: NSPoint(x: -213, y: -47), spacing: 5)
            NSGraphicsContext.restoreGraphicsState()
        }
        fill(NSRect(x: 54, y: 162, width: 250, height: 3), blue)
        fill(NSRect(x: 370, y: 162, width: 250, height: 3), red)
        text("FREELANCER", mono(15), blue, at: NSPoint(x: 54, y: 124), spacing: 2)
        text("CLIENT", mono(15), red, at: NSPoint(x: 370, y: 124), spacing: 2)
        text("CONFIRMED BY BOTH", mono(16), ink, at: NSPoint(x: 54, y: 60), spacing: 3)
    }
    image.unlockFocus()
    return image
}
func material(_ contents: Any, roughness: CGFloat = 0.88) -> SCNMaterial {
    let m = SCNMaterial(); m.lightingModel = .physicallyBased
    m.diffuse.contents = contents; m.roughness.contents = roughness; m.metalness.contents = 0.0
    return m
}
func sheet(_ front: NSImage, _ back: NSImage, w: CGFloat = 2.8, h: CGFloat = 3.7) -> SCNNode {
    let shape = SCNBox(width: w, height: h, length: 0.026, chamferRadius: 0.009)
    shape.chamferSegmentCount = 2
    let edge = material(color(0xe2d6bc))
    shape.materials = [material(front), edge, material(back), edge, edge, edge]
    let n = SCNNode(geometry: shape); n.castsShadow = true; return n
}

final class Film {
    let scene = SCNScene(), camera = SCNNode(), assembly = SCNNode()
    let left: SCNNode, right: SCNNode, contract: SCNNode, stamp = SCNNode()
    let approved: NSImage, draft: NSImage, renderer: SCNRenderer
    let closing: Bool
    init(closing: Bool) {
        self.closing = closing
        approved = texture(kind: "scope", agreed: true); draft = texture(kind: "scope")
        left = sheet(texture(kind: "answer", accent: blue), texture(kind: "sealed", accent: blue))
        right = sheet(texture(kind: "answer", accent: red), texture(kind: "sealed", accent: red))
        contract = sheet(draft, texture(kind: "sealed", accent: blue), w: 3.05, h: 4.05)
        guard let device = MTLCreateSystemDefaultDevice() else { fatalError("Metal GPU unavailable; run outside the sandbox") }
        renderer = SCNRenderer(device: device, options: nil)
        scene.background.contents = closing ? color(0x1b1a17) : paper
        scene.lightingEnvironment.contents = closing ? color(0xaca79b) : color(0xeae3d3)
        scene.lightingEnvironment.intensity = closing ? 0.22 : 0.28
        scene.fogColor = closing ? color(0x1b1a17) : paper
        scene.fogStartDistance = 17; scene.fogEndDistance = 35
        scene.rootNode.addChildNode(assembly)
        assembly.addChildNode(left); assembly.addChildNode(right); assembly.addChildNode(contract)
        let floor = SCNNode(geometry: SCNPlane(width: 200, height: 200))
        floor.geometry!.materials = [material(closing ? color(0x24231f) : color(0xeae2d2))]
        floor.simdEulerAngles.x = -.pi / 2; floor.simdPosition = vec(0, -2.1, 0)
        scene.rootNode.addChildNode(floor)
        camera.camera = SCNCamera(); camera.camera!.fieldOfView = 34
        camera.camera!.zNear = 0.1; camera.camera!.zFar = 250
        camera.camera!.wantsHDR = false
        camera.camera!.bloomIntensity = 0.025
        camera.camera!.wantsDepthOfField = true; camera.camera!.fStop = 6.3
        scene.rootNode.addChildNode(camera)
        func light(_ type: SCNLight.LightType, _ intensity: CGFloat, _ c: NSColor, _ position: SIMD3<Float>, _ shadows: Bool = false) {
            let n = SCNNode(); n.light = SCNLight(); n.light!.type = type
            n.light!.color = c; n.light!.intensity = intensity
            n.simdPosition = position; n.look(at: SCNVector3(0, 0, 0))
            n.light!.castsShadow = shadows; n.light!.shadowMode = .deferred
            n.light!.attenuationStartDistance = 3; n.light!.attenuationEndDistance = 18
            n.light!.shadowRadius = 9; n.light!.shadowSampleCount = 24
            n.light!.shadowColor = NSColor.black.withAlphaComponent(closing ? 0.7 : 0.3)
            n.light!.shadowMapSize = CGSize(width: 2048, height: 2048)
            scene.rootNode.addChildNode(n)
        }
        light(.ambient, 65, color(0xf8edda), vec(0, 0, 0))
        light(.spot, 380, color(0xfff3de), vec(-4, 7, 8), true)
        light(.omni, 20, color(0xb3c5ff), vec(-5, 1, 3))
        light(.omni, 22, color(0xffc8aa), vec(5, 2, -2))
        // Two actual pages under the agreed sheet supply a tangible paper edge.
        for i in 1...3 {
            let n = sheet(draft, draft, w: 3.05, h: 4.05)
            n.simdPosition = vec(Double(i) * 0.025, -Double(i) * 0.018, -Double(i) * 0.032)
            n.simdEulerAngles.z = Float(Double(i) * -0.012)
            contract.addChildNode(n)
        }
        // A rubber stamp with a beveled ink body, steel neck and turned handle.
        let block = SCNNode(geometry: SCNBox(width: 2.5, height: 0.78, length: 0.27, chamferRadius: 0.06))
        block.geometry!.materials = [material(ink, roughness: 0.58)]; stamp.addChildNode(block)
        let plate = SCNNode(geometry: SCNBox(width: 2.38, height: 0.67, length: 0.07, chamferRadius: 0.02))
        plate.geometry!.materials = [material(color(0x403c34))]; plate.simdPosition.z = -0.17; stamp.addChildNode(plate)
        let neck = SCNNode(geometry: SCNCylinder(radius: 0.22, height: 0.72))
        neck.geometry!.materials = [material(color(0x504c43), roughness: 0.45)]
        neck.simdEulerAngles.x = .pi / 2; neck.simdPosition.z = 0.45; stamp.addChildNode(neck)
        let handle = SCNNode(geometry: SCNSphere(radius: 0.5))
        handle.scale = SCNVector3(1.2, 0.65, 1)
        handle.geometry!.materials = [material(color(0x29251f), roughness: 0.4)]
        handle.simdPosition.z = 0.95; stamp.addChildNode(handle)
        assembly.addChildNode(stamp)
        renderer.scene = scene; renderer.pointOfView = camera
        renderer.autoenablesDefaultLighting = false
    }
    func update(_ t: Double) {
        SCNTransaction.begin(); SCNTransaction.disableActions = true
        left.isHidden = closing; right.isHidden = closing
        contract.isHidden = !closing; stamp.isHidden = !closing
        if !closing {
            let arrival = phase(t, 0, 1.7), flip = phase(t, 1.5, 3.55), settle = phase(t, 3.55, 5.7)
            let drift = sin(t * 0.8) * 0.055
            left.simdPosition = vec(mix(-3.6, -1.39, arrival), mix(0.7, 0.67, settle) + drift, mix(1.5, 0.1, arrival))
            right.simdPosition = vec(mix(3.6, 1.4, arrival), mix(-0.3, 0.67, settle) - drift, mix(-1.2, -0.15, arrival))
            left.simdEulerAngles = vec(mix(-0.32, -0.08, settle), .pi * (1 - flip) + mix(0.3, 0.12, settle), mix(-0.2, 0.035, settle))
            right.simdEulerAngles = vec(mix(0.16, -0.08, settle), -.pi * (1 - flip) - mix(0.32, 0.12, settle), mix(0.17, -0.035, settle))
            camera.simdPosition = vec(mix(1.6, 0, arrival) + 0.12 * sin(t * 0.4), mix(1.8, 1.1, arrival), mix(11.4, 12.15, settle))
            camera.look(at: SCNVector3(0, -0.3, 0))
            camera.camera!.focusDistance = 12
        } else {
            let arrival = phase(t, 0, 1.25), impact = phase(t, 1.3, 2.35), leave = phase(t, 2.65, 3.6)
            let jolt = t >= 2.35 ? exp(-(t - 2.35) * 10) * sin((t - 2.35) * 35) : 0
            contract.simdPosition = vec(0, 0.65 - jolt * 0.045, 0)
            contract.simdEulerAngles = vec(mix(-0.24, -0.11, arrival), mix(-0.55, 0.13, arrival), mix(0.18, -0.035, arrival))
            stamp.simdPosition = vec(mix(-0.5, 0, impact) + leave * 1.8, mix(2.3, 0.18, impact) + leave * 3, mix(4.8, 0.25, impact) + leave * 4)
            stamp.simdEulerAngles = vec(mix(-0.35, -0.11, impact), mix(0.35, 0.13, impact), mix(-0.3, -0.17, impact))
            stamp.opacity = CGFloat(phase(t, 0.9, 1.25) * (1 - phase(t, 3.1, 3.6)))
            contract.geometry!.materials[0].diffuse.contents = t >= 2.35 ? approved : draft
            camera.simdPosition = vec(mix(-0.8, 0.15, arrival), 1.15 + jolt * 0.03, mix(11.7, 12.35, phase(t, 2.65, 5.9)))
            camera.look(at: SCNVector3(0, -0.3, 0)); camera.camera!.focusDistance = 12
        }
        SCNTransaction.commit()
    }
    func frame(_ t: Double, context: CGContext) {
        update(t)
        let image = renderer.snapshot(atTime: t, with: CGSize(width: width, height: height), antialiasingMode: .multisampling4X)
        guard let cg = image.cgImage(forProposedRect: nil, context: nil, hints: nil) else { fatalError("GPU snapshot failed") }
        context.draw(cg, in: CGRect(x: 0, y: 0, width: width, height: height))
        if !closing {
            // A paper-coloured lower scrim lets the wordmark resolve cleanly
            // while keeping the studio shadows visible around the objects.
            let gradient = CGGradient(colorsSpace: CGColorSpaceCreateDeviceRGB(), colors: [paper.cgColor, paper.withAlphaComponent(0).cgColor] as CFArray, locations: [0, 1])!
            context.drawLinearGradient(gradient, start: CGPoint(x: 0, y: 0), end: CGPoint(x: 0, y: 520), options: [])
        }
        NSGraphicsContext.saveGraphicsState()
        NSGraphicsContext.current = NSGraphicsContext(cgContext: context, flipped: false)
        // Editorial frame, with quiet registration details and precise type.
        let c = closing ? paper : ink
        context.setAlpha(CGFloat(phase(t, 0.25, 1.1)))
        text("§", serif(40), red, at: NSPoint(x: 80, y: 966))
        text("SCOPEMATCH", mono(15), c.withAlphaComponent(0.75), at: NSPoint(x: 122, y: 982), spacing: 4)
        text(closing ? "02 / AGREEMENT" : "01 / INDEPENDENT ANSWERS", mono(14), c.withAlphaComponent(0.55), at: NSPoint(x: closing ? 1610 : 1460, y: 982), spacing: 2)
        line(NSPoint(x: 80, y: 956), NSPoint(x: 1840, y: 956), c.withAlphaComponent(0.2))
        context.setAlpha(CGFloat(phase(t, closing ? 3.05 : 4.1, closing ? 4.0 : 5.2)))
        let title = NSMutableAttributedString(string: "Scope", attributes: [.font: serif(112), .foregroundColor: c])
        title.append(NSAttributedString(string: "Match", attributes: [.font: serif(112, italic: true), .foregroundColor: c]))
        title.draw(at: NSPoint(x: (1920 - title.size().width) / 2, y: 90 + CGFloat(1 - phase(t, closing ? 3.05 : 4.1, closing ? 4.0 : 5.2)) * -24))
        let subtitle = closing ? "ONE SCOPE · CONFIRMED BY BOTH" : "ONE BRIEF. TWO INTERPRETATIONS."
        let attrs: [NSAttributedString.Key: Any] = [.font: mono(17), .foregroundColor: c.withAlphaComponent(0.65), .kern: 4]
        let sub = NSAttributedString(string: subtitle, attributes: attrs)
        sub.draw(at: NSPoint(x: (1920 - sub.size().width) / 2, y: 59))
        // Two ink rules arrive independently, then settle into one baseline.
        let ruleIn = phase(t, closing ? 3.1 : 4.3, closing ? 4.2 : 5.5)
        fill(NSRect(x: 80, y: 40, width: 300 * ruleIn, height: 3), blue)
        fill(NSRect(x: 1840 - 300 * ruleIn, y: 40, width: 300 * ruleIn, height: 3), red)
        context.setAlpha(1)
        // Fade from/to the same palette, suitable for a cut to the actual app.
        let fade = (1 - phase(t, 0, 0.5)) + (closing ? phase(t, 5.3, 6) : 0)
        fill(NSRect(x: 0, y: 0, width: width, height: height), (closing ? ink : paper).withAlphaComponent(CGFloat(clamp(fade))))
        NSGraphicsContext.restoreGraphicsState()
    }
}

let arguments = CommandLine.arguments
guard arguments.count >= 3, ["intro", "closing"].contains(arguments[1]) else {
    print("Usage: render intro|closing output.mp4 [--still seconds output.png]"); exit(1)
}
let closing = arguments[1] == "closing", output = URL(fileURLWithPath: arguments[2])
let film = Film(closing: closing)
if arguments.count == 6, arguments[3] == "--still", let t = Double(arguments[4]) {
    let image = NSBitmapImageRep(bitmapDataPlanes: nil, pixelsWide: width, pixelsHigh: height, bitsPerSample: 8, samplesPerPixel: 4, hasAlpha: true, isPlanar: false, colorSpaceName: .deviceRGB, bytesPerRow: 0, bitsPerPixel: 0)!
    let context = NSGraphicsContext(bitmapImageRep: image)!.cgContext
    film.frame(t, context: context)
    try image.representation(using: .png, properties: [:])!.write(to: URL(fileURLWithPath: arguments[5]))
    print("Saved still at \(t)s"); exit(0)
}
let writer = try AVAssetWriter(outputURL: output, fileType: .mp4)
let input = AVAssetWriterInput(mediaType: .video, outputSettings: [
    AVVideoCodecKey: AVVideoCodecType.h264, AVVideoWidthKey: width, AVVideoHeightKey: height,
    AVVideoCompressionPropertiesKey: [AVVideoAverageBitRateKey: 18_000_000, AVVideoExpectedSourceFrameRateKey: fps, AVVideoMaxKeyFrameIntervalKey: fps, AVVideoProfileLevelKey: AVVideoProfileLevelH264HighAutoLevel],
    AVVideoColorPropertiesKey: [AVVideoColorPrimariesKey: AVVideoColorPrimaries_ITU_R_709_2, AVVideoTransferFunctionKey: AVVideoTransferFunction_ITU_R_709_2, AVVideoYCbCrMatrixKey: AVVideoYCbCrMatrix_ITU_R_709_2]
])
let adapter = AVAssetWriterInputPixelBufferAdaptor(assetWriterInput: input, sourcePixelBufferAttributes: [
    kCVPixelBufferPixelFormatTypeKey as String: kCVPixelFormatType_32ARGB,
    kCVPixelBufferWidthKey as String: width, kCVPixelBufferHeightKey as String: height,
    kCVPixelBufferCGImageCompatibilityKey as String: true, kCVPixelBufferCGBitmapContextCompatibilityKey as String: true
])
input.expectsMediaDataInRealTime = false; writer.add(input)
guard writer.startWriting() else { fatalError(writer.error!.localizedDescription) }
writer.startSession(atSourceTime: .zero)
let frames = (closing ? 6 : 8) * fps
for i in 0..<frames {
    while !input.isReadyForMoreMediaData { Thread.sleep(forTimeInterval: 0.003) }
    autoreleasepool {
        var buffer: CVPixelBuffer?
        CVPixelBufferPoolCreatePixelBuffer(nil, adapter.pixelBufferPool!, &buffer)
        let pixel = buffer!; CVPixelBufferLockBaseAddress(pixel, [])
        let ctx = CGContext(data: CVPixelBufferGetBaseAddress(pixel), width: width, height: height, bitsPerComponent: 8, bytesPerRow: CVPixelBufferGetBytesPerRow(pixel), space: CGColorSpaceCreateDeviceRGB(), bitmapInfo: CGImageAlphaInfo.noneSkipFirst.rawValue)!
        film.frame(Double(i) / Double(fps), context: ctx)
        CVPixelBufferUnlockBaseAddress(pixel, [])
        guard adapter.append(pixel, withPresentationTime: CMTime(value: Int64(i), timescale: Int32(fps))) else { fatalError(writer.error?.localizedDescription ?? "Append failed") }
    }
    if i % fps == 0 { print("\(arguments[1]): \(i)/\(frames) frames"); fflush(stdout) }
}
input.markAsFinished()
writer.endSession(atSourceTime: CMTime(value: Int64(frames), timescale: Int32(fps)))
let done = DispatchSemaphore(value: 0)
writer.finishWriting { done.signal() }; done.wait()
guard writer.status == .completed else { fatalError(writer.error?.localizedDescription ?? "Encode failed") }
print("Saved \(output.path)")
