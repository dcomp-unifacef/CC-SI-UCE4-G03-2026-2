import jwt from "jsonwebtoken";

export interface AuthPayload {
  psicologaId: number;
  nome: string;
  crp: string;
  email: string;
}

function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error("JWT_SECRET não configurado no .env.local");
  }
  return secret;
}

export function gerarToken(payload: AuthPayload): string {
  return jwt.sign(payload, getJwtSecret(), { expiresIn: "8h" });
}

export function verificarAuth(req: Request): AuthPayload | null {
  const authHeader = req.headers.get("authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return null;
  }

  const token = authHeader.slice(7).trim();
  try {
    return jwt.verify(token, getJwtSecret()) as AuthPayload;
  } catch {
    return null;
  }
}