/** Separa un RUT "XXXXXXXX-X" en número y dígito verificador — formato que exigen algunos webservices del SII (RutXxx/DvXxx separados). */
export function splitRut(rut: string, ErrorClass: new (message: string) => Error): { number: string; dv: string } {
  const match = rut.match(/^(\d{1,8})-([\dkK])$/);
  if (!match?.[1] || !match[2]) {
    throw new ErrorClass(`RUT con formato inválido: "${rut}" (se espera XXXXXXXX-X)`);
  }
  return { number: match[1], dv: match[2] };
}
