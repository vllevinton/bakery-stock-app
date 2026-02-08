export function computeStatus(stockPacks: number, marginMinimumPacks: number) {
  return stockPacks < marginMinimumPacks ? "ALERTA" : "OK";
}

export function computeReplenishPacks(stockPacks: number, marginMinimumPacks: number, minPacksOrder: number) {
  const faltante = Math.max(0, marginMinimumPacks - stockPacks);
  if (faltante === 0) return 0;
  const mp = Math.max(1, minPacksOrder || 1);
  return Math.ceil(faltante / mp) * mp;
}

export function yyyyMmDd(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
