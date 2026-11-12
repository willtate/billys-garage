import SwiftUI

struct ContentView: View {
    @StateObject private var garage = GarageModel()

    var body: some View {
        ZStack {
            GarageSceneView(garage: garage)
                .ignoresSafeArea()

            VStack(spacing: 0) {
                HStack(alignment: .top) {
                    Spacer()
                    VStack(spacing: 22) {
                        BigRoundButton(color: Color(red: 0.15, green: 0.78, blue: 0.3), size: 128, action: garage.vroom) {
                            Text("GO")
                                .font(.system(size: 46, weight: .black, design: .rounded))
                                .foregroundColor(.white)
                        }
                        BigRoundButton(color: Color(red: 1.0, green: 0.8, blue: 0.1), size: 96, action: garage.honk) {
                            Image(systemName: "speaker.wave.3.fill")
                                .font(.system(size: 38, weight: .bold))
                                .foregroundColor(Color(red: 0.45, green: 0.3, blue: 0.0))
                        }
                    }
                }
                .padding(.top, 28)
                .padding(.trailing, 32)

                Spacer(minLength: 0)

                PartTray(garage: garage)
            }
        }
        .statusBar(hidden: true)
    }
}

// MARK: - Tray

struct PartTray: View {
    @ObservedObject var garage: GarageModel

    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            HStack(spacing: 12) {
                ForEach(PartCategory.allCases) { cat in
                    CategoryButton(category: cat, icon: garage.categoryIcon(cat), selected: garage.category == cat) {
                        garage.pick(cat)
                    }
                }
            }
            .padding(.leading, 28)

            ScrollViewReader { proxy in
                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(spacing: 18) {
                        options
                    }
                    .padding(.horizontal, 26)
                    .padding(.vertical, 18)
                    .id(garage.category)
                }
                .onChange(of: garage.category) { _ in
                    withAnimation { proxy.scrollTo(garage.category, anchor: .leading) }
                }
            }
            .background(
                ZStack(alignment: .top) {
                    RoundedRectangle(cornerRadius: 30, style: .continuous)
                        .fill(LinearGradient(colors: [Color(white: 0.22), Color(white: 0.13)], startPoint: .top, endPoint: .bottom))
                    HazardStripe()
                        .frame(height: 12)
                        .clipShape(RoundedRectangle(cornerRadius: 30, style: .continuous).inset(by: 0).offset(y: 0))
                        .mask(RoundedRectangle(cornerRadius: 30, style: .continuous).padding(.bottom, -18))
                }
                .shadow(color: .black.opacity(0.35), radius: 14, y: 6)
            )
            .padding(.horizontal, 18)
            .padding(.bottom, 14)
        }
    }

    @ViewBuilder private var options: some View {
        let cat = garage.category
        let tint = Color(cat.tint)
        switch cat {
        case .paint:
            ForEach(Catalog.paints) { p in
                PaintCard(paint: p, selected: garage.design.paint == p.id) {
                    garage.update { $0.paint = p.id }
                }
            }
        default:
            ForEach(choices(cat), id: \.self) { id in
                PartCard(image: id == "none" ? nil : garage.thumbnail(cat, id),
                         placeholder: id == "none" ? "nosign" : cat.symbol, tint: tint,
                         selected: current(cat) == id) {
                    garage.update { d in
                        switch cat {
                        case .body: d.body = id
                        case .wheels: d.wheels = id
                        case .sticker: d.sticker = id
                        default: if let slot = cat.slot { d.setAddon(slot, id) }
                        }
                    }
                }
            }
        }
    }

    private func choices(_ cat: PartCategory) -> [String] {
        switch cat {
        case .body: return Catalog.bodies.map(\.id)
        case .wheels: return Catalog.wheels.map(\.id)
        case .paint: return Catalog.paints.map(\.id)
        case .sticker: return Catalog.stickers.map(\.id)
        default: return Catalog.addons(cat.slot!).map(\.id)
        }
    }

    private func current(_ cat: PartCategory) -> String {
        let d = garage.design
        switch cat {
        case .body: return d.body
        case .wheels: return d.wheels
        case .paint: return d.paint
        case .sticker: return d.sticker
        default: return d.addon(cat.slot!)
        }
    }
}

struct HazardStripe: View {
    var body: some View {
        GeometryReader { geo in
            Path { p in
                let h = geo.size.height
                var x: CGFloat = -h
                while x < geo.size.width + h {
                    p.move(to: CGPoint(x: x, y: h))
                    p.addLine(to: CGPoint(x: x + h, y: 0))
                    p.addLine(to: CGPoint(x: x + h * 2, y: 0))
                    p.addLine(to: CGPoint(x: x + h, y: h))
                    p.closeSubpath()
                    x += h * 2.4
                }
            }
            .fill(Color.black)
            .background(Color(red: 1, green: 0.8, blue: 0))
        }
    }
}

// MARK: - Pieces

struct BouncyButtonStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .scaleEffect(configuration.isPressed ? 0.88 : 1)
            .animation(.spring(response: 0.25, dampingFraction: 0.55), value: configuration.isPressed)
    }
}

struct BigRoundButton<Label: View>: View {
    let color: Color
    let size: CGFloat
    let action: () -> Void
    @ViewBuilder let label: () -> Label

    var body: some View {
        Button(action: action) {
            ZStack {
                Circle().fill(color.opacity(0.55)).offset(y: 7)
                Circle().fill(color)
                Circle()
                    .fill(LinearGradient(colors: [.white.opacity(0.45), .clear], startPoint: .top, endPoint: .center))
                    .padding(6)
                label()
            }
            .frame(width: size, height: size)
            .shadow(color: .black.opacity(0.2), radius: 10, y: 8)
        }
        .buttonStyle(BouncyButtonStyle())
    }
}

struct CategoryButton: View {
    let category: PartCategory
    let icon: UIImage?
    let selected: Bool
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            ZStack {
                Circle().fill(Color(category.tint))
                Circle()
                    .fill(LinearGradient(colors: [.white.opacity(0.4), .clear], startPoint: .top, endPoint: .center))
                    .padding(5)
                if let icon = icon {
                    Image(uiImage: icon).resizable().scaledToFit().padding(6)
                } else {
                    Image(systemName: category.symbol)
                        .font(.system(size: 30, weight: .bold))
                        .foregroundColor(.white)
                }
            }
            .frame(width: 80, height: 80)
            .overlay(Circle().stroke(Color.white, lineWidth: selected ? 6 : 0))
            .shadow(color: .black.opacity(selected ? 0.35 : 0.2), radius: selected ? 10 : 5, y: 5)
            .scaleEffect(selected ? 1.12 : 0.92)
            .animation(.spring(response: 0.3, dampingFraction: 0.6), value: selected)
        }
        .buttonStyle(BouncyButtonStyle())
    }
}

struct PartCard: View {
    let image: UIImage?
    let placeholder: String
    let tint: Color
    let selected: Bool
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            ZStack {
                RoundedRectangle(cornerRadius: 24, style: .continuous)
                    .fill(Color(white: selected ? 0.36 : 0.27))
                RoundedRectangle(cornerRadius: 24, style: .continuous)
                    .fill(RadialGradient(colors: [tint.opacity(selected ? 0.45 : 0.18), .clear], center: .center, startRadius: 10, endRadius: 110))
                if let image = image {
                    Image(uiImage: image)
                        .resizable()
                        .scaledToFit()
                        .padding(2)
                } else {
                    Image(systemName: placeholder)
                        .font(.system(size: 52, weight: .bold))
                        .foregroundColor(Color(white: 0.6))
                }
            }
            .frame(width: 172, height: 150)
            .overlay(
                RoundedRectangle(cornerRadius: 24, style: .continuous)
                    .stroke(selected ? tint : Color.clear, lineWidth: 7)
            )
            .scaleEffect(selected ? 1.05 : 1)
            .animation(.spring(response: 0.3, dampingFraction: 0.6), value: selected)
        }
        .buttonStyle(BouncyButtonStyle())
    }
}

struct PaintCard: View {
    let paint: PaintStyle
    let selected: Bool
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            ZStack {
                Circle().fill(Color(paint.color))
                if paint.metallic {
                    Circle().fill(AngularGradient(colors: [.white.opacity(0.5), .clear, .white.opacity(0.35), .clear, .white.opacity(0.5)], center: .center))
                }
                Circle()
                    .fill(LinearGradient(colors: [.white.opacity(0.55), .clear], startPoint: .topLeading, endPoint: .center))
                    .padding(10)
                Circle().stroke(Color.black.opacity(0.08), lineWidth: 2)
            }
            .frame(width: 120, height: 120)
            .padding(14)
            .overlay(Circle().stroke(Color(paint.color), lineWidth: selected ? 7 : 0).padding(2))
            .scaleEffect(selected ? 1.06 : 1)
            .animation(.spring(response: 0.3, dampingFraction: 0.6), value: selected)
        }
        .buttonStyle(BouncyButtonStyle())
    }
}
