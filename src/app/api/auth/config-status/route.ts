import { NextResponse } from "next/server";
import {
  getAuthConfigStatus,
} from "@/lib/env-checks";

export async function GET(): Promise<NextResponse> {
  return NextResponse.json(getAuthConfigStatus());
}
