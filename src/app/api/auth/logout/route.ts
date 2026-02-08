import { NextResponse } from "next/server";
import { clearSessionCookie } from "@/lib/auth";

export async function GET(req: Request) {
  clearSessionCookie();
  const url = new URL(req.url);
  const base = url.origin;
  return NextResponse.redirect(`${base}/login`);
}
