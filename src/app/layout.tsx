import "./globals.css";
import React from "react";

export const metadata = {
  title: "Panadería - Sistema de Gestión de Stock",
  description: "App web para registrar stock en packs y enviar alertas automáticas."
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
