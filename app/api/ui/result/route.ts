// app/api/use_ui/route.ts
import { NextRequest, NextResponse } from "next/server";
import { uiResultBridge } from "@/lib/use-ui-result";

export async function POST(req: NextRequest) {
  try {
    const { chatId, result, taskName } = await req.json();

    if (!chatId) {
      return NextResponse.json({ error: "chatId is required" }, { status: 400 });
    }

    console.log("Received UI result for chatId:", chatId, result);
    uiResultBridge.setResult(chatId, result, taskName);
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
