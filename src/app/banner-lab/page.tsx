import Link from "next/link";

type Shot = {
  n: number;
  desktop: string;
  mobile: string;
  desktopKB: number;
  mobileKB: number;
  frame: string;
  fit: "cover" | "contain";
  focus: string;
  note: string;
};

const SHOTS: Shot[] = [
  {
    n: 1,
    desktop: "/brand/banner-1-desktop.webp",
    mobile: "/brand/banner-1-mobile.webp",
    desktopKB: 180,
    mobileKB: 75,
    frame: "16 : 9",
    fit: "contain",
    focus: "50% 50%",
    note: "Escritorio sin zoom, vertical completa. Movil con la modelo a la izquierda, como pediste.",
  },
  {
    n: 2,
    desktop: "/brand/banner-2-desktop.webp",
    mobile: "/brand/banner-2-mobile.webp",
    desktopKB: 117,
    mobileKB: 45,
    frame: "16 : 9",
    fit: "contain",
    focus: "50% 50%",
    note: "Escritorio sin zoom, vertical completa. Movil con la modelo a la izquierda, como pediste.",
  },
  {
    n: 3,
    desktop: "/brand/banner-3-desktop.webp",
    mobile: "/brand/banner-3-mobile.webp",
    desktopKB: 289,
    mobileKB: 109,
    frame: "2.6 : 1",
    fit: "cover",
    focus: "50% 50%",
    note: "Encuadre que ya te gustaba. Es el que esta publicado en el home.",
  },
  {
    n: 4,
    desktop: "/brand/banner-4-desktop.webp",
    mobile: "/brand/banner-4-mobile.webp",
    desktopKB: 170,
    mobileKB: 69,
    frame: "2.6 : 1",
    fit: "cover",
    focus: "50% 50%",
    note: "Misma configuracion que el 3: cover y centro.",
  },
  {
    n: 5,
    desktop: "/brand/banner-5-desktop.webp",
    mobile: "/brand/banner-5-mobile.webp",
    desktopKB: 193,
    mobileKB: 77,
    frame: "2.6 : 1",
    fit: "cover",
    focus: "50% 50%",
    note: "Misma configuracion que el 3: cover y centro.",
  },
];

export default function BannerLab() {
  const totalKB = SHOTS.reduce((sum, shot) => sum + shot.desktopKB + shot.mobileKB, 0);

  return (
    <main className="min-h-screen bg-linen px-4 py-10 text-ink">
      <div className="mx-auto max-w-6xl">
        <header className="mb-10">
          <p className="text-xs font-semibold uppercase tracking-widest text-ink/60">Galeria interna</p>
          <h1 className="mt-2 text-3xl font-semibold">Los 5 banners</h1>
          <p className="mt-3 max-w-2xl text-sm text-ink/70">
            Mismo marco y mismo texto en los cinco, para comprar solo el encuadre. En escritorio el 1 y el 2 muestran la
            foto completa sin zoom. En movil la modelo queda a la izquierda. Los cinco WebP suman {totalKB} KB y los JPG
            originales sumaban 13,7 MB.
          </p>
          <p className="mt-2 text-xs text-ink/50">
            El 3 esta publicado en el home. Para publicar otro: panel /admin/diseno, elegirlo y publicar.
          </p>
        </header>

        <div className="space-y-14">
          {SHOTS.map((shot) => (
            <section key={shot.n}>
              <div className="mb-3 flex flex-wrap items-baseline gap-2">
                <h2 className="text-lg font-semibold">Banner {shot.n}</h2>
                <span className="text-xs text-ink/50">
                  escritorio {shot.desktopKB} KB, movil {shot.mobileKB} KB
                </span>
              </div>
              <p className="mb-4 text-sm text-ink/70">{shot.note}</p>

              <div
                className="relative w-full overflow-hidden rounded-2xl bg-[#efe9df]"
                style={{ aspectRatio: shot.frame.replace(" : ", "/") }}
              >
                <img
                  src={shot.desktop}
                  alt={"Banner " + shot.n + " en escritorio"}
                  className="absolute inset-0 h-full w-full"
                  style={{ objectFit: shot.fit, objectPosition: shot.focus }}
                />
                <div className="absolute inset-0 bg-black/30" />
                <div className="relative flex h-full flex-col justify-center gap-3 p-8 sm:p-14">
                  <p className="text-xs font-semibold uppercase tracking-widest text-white/80">
                    Hecho a mano en Colombia
                  </p>
                  <p className="max-w-md text-2xl font-semibold text-white sm:text-4xl">El mar te queda bien</p>
                  <p className="max-w-sm text-sm text-white/85">Envio gratis desde $250.000</p>
                  <Link href="/coleccion" className="btn-primary mt-2 w-fit">
                    Comprar ahora
                  </Link>
                </div>
              </div>

              <div className="mt-4 w-72">
                <div className="relative overflow-hidden rounded-2xl bg-[#efe9df]" style={{ aspectRatio: "4/5" }}>
                  <img
                    src={shot.mobile}
                    alt={"Banner " + shot.n + " en movil"}
                    className="absolute inset-0 h-full w-full object-cover"
                  />
                  <div className="absolute inset-0 bg-black/30" />
                  <div className="relative flex h-full flex-col justify-center gap-3 p-6">
                    <p className="text-xs font-semibold uppercase tracking-widest text-white/80">
                      Hecho a mano en Colombia
                    </p>
                    <p className="text-2xl font-semibold text-white">El mar te queda bien</p>
                    <p className="text-sm text-white/85">Envio gratis desde $250.000</p>
                    <span className="btn-primary mt-1 w-fit">Comprar ahora</span>
                  </div>
                </div>
                <p className="mt-1 text-xs text-ink/50">Movil 4:5</p>
              </div>
            </section>
          ))}
        </div>
      </div>
    </main>
  );
}
