/**
 * El SII trabaja en ISO-8859-1 (Latin-1), no UTF-8. Este es el único punto
 * del pipeline donde se debe convertir entre JS (UTF-16 interno) y el
 * encoding que espera el SII. Ningún otro módulo debería tocar encoding
 * directamente.
 */

export function toISO88591(text: string): Buffer {
  return Buffer.from(text, "latin1");
}

export function fromISO88591(data: Buffer): string {
  return data.toString("latin1");
}
