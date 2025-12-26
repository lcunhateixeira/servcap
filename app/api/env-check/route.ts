import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL ?? null,
    NEXT_PUBLIC_SUPABASE_ANON_KEY:
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
        ? `SET (${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY.length} chars)`
        : null,
  });
}
