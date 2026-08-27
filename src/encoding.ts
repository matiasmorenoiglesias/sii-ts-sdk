/**
 * El SII trabaja en ISO-8859-1 (Latin-1), no UTF-8. Este es el único punto
 * del pipeline donde se debe convertir entre JS (UTF-16 interno) y el
 * encoding que espera el SII. Ningún otro módulo debería tocar encoding
 * directamente.
 */

export function aISO88591(texto: string): Buffer {
  return Buffer.from(texto, "latin1");
}

export function desdeISO88591(datos: Buffer): string {
  return datos.toString("latin1");
}
