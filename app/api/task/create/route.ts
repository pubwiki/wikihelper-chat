// app/api/use_ui/route.ts
import { NextRequest, NextResponse } from "next/server";
import { WIKIFRAM_ENDPOINT } from "@/lib/constants";

export async function POST(req: NextRequest) {
  try {
    const { slug, language, name, reqcookie } = await req.json() as {slug: string, language: string, name: string, reqcookie: string};
    const backendUrl = `${WIKIFRAM_ENDPOINT}provisioner/v1/wikis`;

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
    console.log("Create Wiki Response:", rtext);
    const result = JSON.parse(rtext);
    const { task_id } = result;
    console.log(result)

    return NextResponse.json({ ok: true, taskId: task_id });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
 