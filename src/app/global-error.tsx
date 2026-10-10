"use client";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="es">
      <body
        style={{
          fontFamily: "system-ui, sans-serif",
          background: "#faf3e4",
          color: "#241a10",
          padding: "4rem 1.5rem",
          textAlign: "center",
        }}
      >
        <h1 style={{ fontSize: "1.5rem", marginBottom: "0.5rem" }}>Algo salió mal</h1>
        <p style={{ color: "#5a4a38", marginBottom: "1.5rem" }}>
          Ocurrió un error inesperado. Vuelve a intentarlo.
        </p>
        <button
          onClick={() => reset()}
          style={{
            padding: "0.6rem 1.4rem",
            borderRadius: "9999px",
            border: "none",
            background: "#c9643c",
            color: "#fffdf8",
            cursor: "pointer",
          }}
        >
          Reintentar
        </button>
        {error.digest ? (
          <p style={{ color: "#5a4a38", fontSize: "0.75rem", marginTop: "2rem" }}>Ref: {error.digest}</p>
        ) : null}
      </body>
    </html>
  );
}
