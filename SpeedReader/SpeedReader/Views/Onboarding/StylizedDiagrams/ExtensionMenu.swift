import SwiftUI

/// Stylized Safari extension dropdown menu with SpeedReader highlighted.
/// Uses the actual app icon for recognition.
struct ExtensionMenu: View {
    var body: some View {
        VStack(spacing: 0) {
            Text("Extensions")
                .font(.caption)
                .fontWeight(.semibold)
                .foregroundStyle(.secondary)
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(.horizontal, 14)
                .padding(.vertical, 10)

            Divider()

            extensionRow(
                icon: AnyView(
                    RoundedRectangle(cornerRadius: 6)
                        .fill(.quaternary)
                        .frame(width: 28, height: 28)
                ),
                name: "Other Extension",
                highlighted: false
            )
            .opacity(0.35)

            extensionRow(
                icon: AnyView(
                    Image("AppIcon-Small")
                        .resizable()
                        .frame(width: 28, height: 28)
                        .clipShape(RoundedRectangle(cornerRadius: 6))
                ),
                name: "SpeedReader",
                highlighted: true
            )

            extensionRow(
                icon: AnyView(
                    RoundedRectangle(cornerRadius: 6)
                        .fill(.quaternary)
                        .frame(width: 28, height: 28)
                ),
                name: "Another Extension",
                highlighted: false
            )
            .opacity(0.35)
        }
        .background(.background)
        .clipShape(RoundedRectangle(cornerRadius: 12))
        .shadow(color: .black.opacity(0.12), radius: 8, y: 2)
        .frame(maxWidth: 260)
        .accessibilityElement(children: .combine)
        .accessibilityLabel("Extensions menu. SpeedReader is highlighted.")
    }

    private func extensionRow(icon: AnyView, name: String, highlighted: Bool) -> some View {
        HStack(spacing: 10) {
            icon
            Text(name)
                .font(.subheadline)
                .fontWeight(highlighted ? .semibold : .regular)
                .foregroundStyle(highlighted ? Color.red : .primary)
        }
        .padding(.horizontal, 14)
        .padding(.vertical, 10)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(highlighted ? Color.red.opacity(0.06) : .clear)
        .overlay(alignment: .leading) {
            if highlighted {
                Rectangle()
                    .fill(Color.red)
                    .frame(width: 3)
            }
        }
    }
}
