"use client";
import React, { useEffect, useState } from "react";
import { Input } from "@/components/Input";
import { Button } from "@/components/Button";

export default function LoginForm() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // ✅ esperamos a limpiar la sesión anterior
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        // Tu /api/auth/logout es GET y redirige a /login.
        // redirect:"manual" evita que el navegador siga la redirección.
        await fetch("/api/auth/logout", { method: "GET", redirect: "manual" });
      } catch {
        // Si falla, no bloqueamos el login
      } finally {
        if (!cancelled) setReady(true);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setLoading(true);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "Error al iniciar sesión");

      window.location.href = data.redirectTo;
    } catch (e: any) {
      setErr(e?.message || "Error");
    } finally {
      setLoading(false);
    }
  }

  // ✅ mientras limpia sesión, mostramos algo simple
  if (!ready) {
    return <div className="text-sm text-slate-500">Cargando...</div>;
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <Input
        label="Usuario"
        placeholder="Ingresa tu usuario"
        value={username}
        onChange={(e) => setUsername(e.target.value)}
        autoFocus
      />
      <Input
        label="Contraseña"
        type="password"
        placeholder="Ingresa tu contraseña"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
      />

      {err ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
          {err}
        </div>
      ) : null}

      <Button className="w-full py-3" type="submit" disabled={loading}>
        {loading ? "Ingresando..." : "Ingresar"}
      </Button>
    </form>
  );
}
