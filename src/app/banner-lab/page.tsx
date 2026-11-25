import fs from "node:fs";
import path from "node:path";

function peso(file: string) {
  try {
    return Math.round(fs.statSync(path.join("public", "brand", file)).size / 1024) + " KB";
  } catch {
    return "falta";
  }
}

const banners = [
  { n: 1, ratio: "16 / 9", fit: "contain", nota: "vertical completa, sin zoom" },
  { n: 2, ratio: "16 / 9", fit: "contain", nota: "vertical completa, sin zoom" },
  { n: 3, ratio: "2.6", fit: "cover", nota: "igual que banner_3" },
  { n: 4, ratio: "2.6", fit: "cover", nota: "igual que banner_3" },
  { n: 5, ratio: "2.6", fit: "cover", nota: "igual que banner_3" },
];

export default function BannerLab() {
  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-12 px-4 py-10">
      <header>
        <h1 className="text-2xl font-semibold">Banners optimizados</h1>
        <p className="mt-2 text-sm text-neutral-600">
          WebP calidad 78. Escritorio 2200 px de ancho. Movil recorte 4:5 propio.
        </p>
        <p className="mt-1 text-xs text-neutral-500">
          banner-1 escritorio: {peso("banner-1-desktop.webp")} | movil: {peso("banner-1-mobile.webp")}
        </p>
        <p className="text-xs text-neutral-500">
          banner-2 escritorio: {peso("banner-2-desktop.webp")} | movil: {peso("banner-2-mobile.webp")}
        </p>
        <p className="text-xs text-neutral-500">
          banner-3 escritorio: {peso("banner-3-desktop.webp")} | movil: {peso("banner-3-mobile.webp")}
        </p>
        <p className="text-xs text-neutral-500">
          banner-4 escritorio: {peso("banner-4-desktop.webp")} | movil: {peso("banner-4-mobile.webp")}
        </p>
        <p className="text-xs text-neutral-500">
          banner-5 escritorio: {peso("banner-5-desktop.webp")} | movil: {peso("banner-5-mobile.webp")}
        </p>
      </header>

      {banners.map((b) => (
        <section key={b.n} className="flex flex-col gap-3">
          <h2 className="text-lg font-semibold">
            Banner_{b.n} <span className="text-xs font-normal text-neutral-500">{b.nota}</span>
          </h2>

          <div
            className="relative w-full overflow-hidden rounded-lg bg-neutral-900"
            style={{ aspectRatio: b.ratio }}
          >
            <img
              src={"/brand/banner-" + b.n + "-desktop.webp"}
              alt={"Banner " + b.n}
              className="absolute inset-0 h-full w-full"
              style={{ objectFit: b.fit as "cover" | "contain", objectPosition: "center" }}
            />
            <div className="absolute inset-0 bg-black/30" />
            <div className="absolute inset-0 flex flex-col justify-end gap-2 p-5 text-white">
              <p className="text-[10px] uppercase tracking-[0.18em]">Hecho a mano en Colombia</p>
              <p className="text-xl font-semibold leading-tight">El mar te queda bien</p>
              <p className="text-sm">Swimwear de corte limpio, cosido a mano.</p>
              <span className="w-fit rounded-full bg-white px-4 py-2 text-xs font-semibold text-neutral-900">
                Comprar ahora
              </span>
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <p className="text-xs text-neutral-500">Movil 4:5</p>
            <div className="relative w-[280px] overflow-hidden rounded-lg bg-neutral-900" style={{ aspectRatio: "4 / 5" }}>
              <img
                src={"/brand/banner-" + b.n + "-mobile.webp"}
                alt={"Banner " + b.n + " movil"}
                className="absolute inset-0 h-full w-full object-cover"
              />
              <div className="absolute inset-0 bg-black/30" />
              <div className="absolute inset-0 flex flex-col justify-end gap-1 p-4 text-white">
                <p className="text-[9px] uppercase tracking-[0.18em]">Hecho a mano en Colombia</p>
                <p className="text-base font-semibold leading-tight">El mar te queda bien</p>
                <span className="w-fit rounded-full bg-white px-3 py-1.5 text-[10px] font-semibold text-neutral-900">
                  Comprar ahora
                </span>
              </div>
            </div>
          </div>
        </section>
      ))}
    </div>
  );
}
