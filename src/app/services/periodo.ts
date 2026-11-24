export function fechaLocal(d = new Date()): string { return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; }
export function rangoRapido(p: string): [string, string] { const d = new Date(), fin = fechaLocal(d); if (p === 'mes') d.setDate(1); else d.setDate(d.getDate() - Number(p) + 1); return [fechaLocal(d), fin]; }
export function rangoValido(a: string, b: string): boolean { return !!a && !!b && a <= b && b <= fechaLocal() && (Date.parse(b) - Date.parse(a)) / 86400000 < 366; }
