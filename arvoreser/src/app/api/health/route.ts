import { NextResponse } from "next/server";
import { pool } from "@/lib/db";

export async function GET() {
  try {
    const result = await pool.query("SELECT NOW() AS hora_banco");
    return NextResponse.json({
      status: "ok",
      banco: "conectado",
      hora_banco: result.rows[0].hora_banco,
    });
  } catch (error) {
    console.error("Erro ao conectar no PostgreSQL:", error);
    return NextResponse.json(
      { status: "erro", detalhe: "Falha na conexão com o PostgreSQL" },
      { status: 500 }
    );
  }
}