import { NextResponse } from "next/server";
import { getAuthConfigStatus } from "@/lib/env-checks";

export const runtime = "edge";

export async function GET(): Promise<NextResponse> {
  return NextResponse.json(getAuthConfigStatus());
}
