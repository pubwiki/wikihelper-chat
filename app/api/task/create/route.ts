// app/api/use_ui/route.ts
import { NextRequest, NextResponse } from "next/server";
import { WIKIFRAM_ENDPOINT } from "@/lib/constants";

export async function POST(req: NextRequest) {
  try {
    const { slug, language, name, reqcookie } = await req.json() as {slug: string, language: string, name: string, reqcookie: string};
    const backendUrl = `${WIKIFRAM_ENDPOINT}provisioner/v1/wikis`;
    console.log("Creating wiki with:", { slug, language, name, reqcookie });
    if (!slug || !language || !name) {
      return NextResponse.json({ error: "Missing slug, language or name" }, { status: 400 });
    }

    const res = await fetch(backendUrl,{
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Cookie": reqcookie,
        },
        body: JSON.stringify({ slug, language, name }),
    });
    const rtext = await res.text();
    console.log("Create wiki response text:", rtext);
    const result = JSON.parse(rtext);

    const { task_id } = result;

    if (result.error || !task_id) {
      throw new Error( `${result.error}: ${result.message}` || "Failed to create wiki");
    }

    return NextResponse.json({ ok: true, taskId: task_id });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
 