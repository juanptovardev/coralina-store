/* Vista temporal para revisar banners en local. Untracked: no se despliega. */
const banners = [
  { src: "/brand/banner-01.jpg", label: "banner-01 (modelos, 2:1)" },
  { src: "/brand/banner-02.jpg", label: "banner-02 (e-commerce, 2.6:1)" },
  { src: "/brand/producto-01.jpg", label: "producto-01 (vertical 2:3)" },
];

export default function BannerPreview() {
  return (
    <main style={{ background: "#F6F1EA", minHeight: "100vh", padding: 24, fontFamily: "system-ui, sans-serif" }}>
      <h1 style={{ fontSize: 18, margin: "0 0 16px" }}>Vista previa de banners</h1>
      {banners.map((b) => (
        <section key={b.src} style={{ marginBottom: 32 }}>
          <p style={{ fontSize: 12, letterSpacing: 1, textTransform: "uppercase", color: "#7A6E63", margin: "0 0 8px" }}>
            {b.label}
          </p>
          <div style={{ width: "100%", maxWidth: 1100, aspectRatio: "2.6", overflow: "hidden", borderRadius: 12, position: "relative" }}>
            <img src={b.src} alt={b.label} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
            <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.28)" }} />
            <div style={{ position: "absolute", left: 28, bottom: 28, color: "#fff", maxWidth: 460 }}>
              <p style={{ margin: 0, fontSize: 11, letterSpacing: 2, textTransform: "uppercase", opacity: 0.9 }}>
                Hecho a mano en Colombia
              </p>
              <h2 style={{ margin: "6px 0 8px", fontSize: 40, lineHeight: 1.05 }}>El mar te queda bien</h2>
              <p style={{ margin: "0 0 14px", fontSize: 14, opacity: 0.92 }}>
                Vestidos de bano de corte limpio, cosidos a mano. Envio gratis desde $250.000.
              </p>
              <span style={{ background: "#C4512F", color: "#fff", padding: "10px 18px", borderRadius: 8, fontSize: 14 }}>
                Comprar ahora
              </span>
            </div>
          </div>
          <div style={{ marginTop: 10, width: 320 }}>
            <p style={{ fontSize: 11, color: "#7A6E63", margin: "0 0 6px" }}>Movil (recorte 4:5)</p>
            <div style={{ width: 320, aspectRatio: "4 / 5", overflow: "hidden", borderRadius: 12, position: "relative" }}>
              <img src={b.src} alt={b.label} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
              <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.28)" }} />
            </div>
          </div>
        </section>
      ))}
    </main>
  );
}
