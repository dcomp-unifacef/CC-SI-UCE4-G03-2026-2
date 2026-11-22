import crypto from "crypto";

const ALGORITMO = "aes-256-gcm";

function getKey(): Buffer {
  const hexKey = process.env.ENCRYPTION_KEY;
  if (!hexKey || hexKey.length !== 64) {
    throw new Error(
      "ENCRYPTION_KEY inválida no .env.local (precisa ter exatamente 64 caracteres hexadecimais)."
    );
  }
  return Buffer.from(hexKey, "hex");
}

export function criptografarTexto(textoPlano: string): string {
  const key = getKey();
  const iv = crypto.randomBytes(12); // Padrão recomendado para GCM
  const cipher = crypto.createCipheriv(ALGORITMO, key, iv);

  const criptografado = Buffer.concat([
    cipher.update(textoPlano, "utf8"),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();

  // Formato armazenado no PostgreSQL: iv:authTag:conteudoCifrado
  return `${iv.toString("hex")}:${authTag.toString("hex")}:${criptografado.toString("hex")}`;
}

export function descriptografarTexto(payload: string): string {
  const partes = payload.split(":");
  if (partes.length !== 3) {
    throw new Error("Formato de prontuário criptografado inválido.");
  }

  const [ivHex, authTagHex, dadoHex] = partes;
  const key = getKey();
  const iv = Buffer.from(ivHex, "hex");
  const authTag = Buffer.from(authTagHex, "hex");
  const dadoCriptografado = Buffer.from(dadoHex, "hex");

  const decipher = crypto.createDecipheriv(ALGORITMO, key, iv);
  decipher.setAuthTag(authTag);

  const descriptografado = Buffer.concat([
    decipher.update(dadoCriptografado),
    decipher.final(),
  ]);

  return descriptografado.toString("utf8");
}