// app/api/use_ui/route.ts
import { NextRequest, NextResponse } from "next/server";
import { useUIResult } from "@/lib/use-ui-result";

export async function POST(req: NextRequest) {
  try {
    const { chatId, result } = await req.json();

    if (!chatId) {
      return NextResponse.json({ error: "chatId is required" }, { status: 400 });
    }

    console.log("Received UI result for chatId:", chatId, result);
    useUIResult.setResult(chatId, result);

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
