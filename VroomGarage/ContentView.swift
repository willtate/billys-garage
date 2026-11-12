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
            HStack(spacing: 18) {
                ForEach(PartCategory.allCases) { cat in
                    CategoryButton(category: cat, selected: garage.category == cat) {
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
                RoundedRectangle(cornerRadius: 36, style: .continuous)
                    .fill(Color.white.opacity(0.82))
                    .shadow(color: .black.opacity(0.12), radius: 14, y: 6)
            )
            .padding(.horizontal, 18)
            .padding(.bottom, 14)
        }
    }

    @ViewBuilder private var options: some View {
        let tint = Color(garage.category.tint)
        switch garage.category {
        case .body:
            ForEach(Catalog.bodies) { b in
                PartCard(image: garage.thumbnail(body: b.id), placeholder: "car.fill", tint: tint,
                         selected: garage.design.body == b.id) {
                    garage.update { $0.body = b.id }
                }
            }
        case .wheels:
            ForEach(Catalog.wheels) { w in
                PartCard(image: garage.thumbnail(wheel: w.id), placeholder: "circle.circle.fill", tint: tint,
                         selected: garage.design.wheels == w.id) {
                    garage.update { $0.wheels = w.id }
                }
            }
        case .paint:
            ForEach(Catalog.paints) { p in
                PaintCard(paint: p, selected: garage.design.paint == p.id) {
                    garage.update { $0.paint = p.id }
                }
            }
        case .topper:
            ForEach(Catalog.toppers) { t in
                PartCard(image: t.build == nil ? nil : garage.thumbnail(topper: t.id),
                         placeholder: t.build == nil ? "nosign" : "sparkles", tint: tint,
                         selected: garage.design.topper == t.id) {
                    garage.update { $0.topper = t.id }
                }
            }
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
    let selected: Bool
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            ZStack {
                Circle().fill(Color(category.tint))
                Circle()
                    .fill(LinearGradient(colors: [.white.opacity(0.4), .clear], startPoint: .top, endPoint: .center))
                    .padding(5)
                Image(systemName: category.symbol)
                    .font(.system(size: 34, weight: .bold))
                    .foregroundColor(.white)
            }
            .frame(width: 86, height: 86)
            .overlay(Circle().stroke(Color.white, lineWidth: selected ? 7 : 0))
            .shadow(color: .black.opacity(selected ? 0.3 : 0.15), radius: selected ? 10 : 5, y: 5)
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
                RoundedRectangle(cornerRadius: 28, style: .continuous)
                    .fill(tint.opacity(selected ? 0.32 : 0.14))
                if let image = image {
                    Image(uiImage: image)
                        .resizable()
                        .scaledToFit()
                        .padding(2)
                } else {
                    Image(systemName: placeholder)
                        .font(.system(size: 52, weight: .bold))
                        .foregroundColor(tint.opacity(0.7))
                }
            }
            .frame(width: 172, height: 150)
            .overlay(
                RoundedRectangle(cornerRadius: 28, style: .continuous)
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
