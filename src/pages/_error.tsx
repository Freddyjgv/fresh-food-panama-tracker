import React from "react";

type Props = {
  statusCode?: number;
};

export default function ErrorPage({ statusCode }: Props) {
  return (
    <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 24 }}>
      <div style={{ maxWidth: 720, width: "100%", background: "white", border: "1px solid #eee", borderRadius: 12, padding: 18 }}>
        <h1 style={{ margin: 0, fontSize: 20 }}>Ocurrió un error</h1>
        <p style={{ marginTop: 10, color: "#555" }}>
          {statusCode
            ? `Código: ${statusCode}`
            : "Error inesperado. Revisa la consola/terminal para ver el detalle."}
        </p>
      </div>
    </div>
  );
}

ErrorPage.getInitialProps = ({ res, err }: any) => {
  const statusCode = res?.statusCode ?? err?.statusCode ?? 500;
  return { statusCode };
};