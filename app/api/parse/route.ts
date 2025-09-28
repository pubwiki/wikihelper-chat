import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const { wikitext } = await req.json();

    if (!wikitext) {
      return NextResponse.json({ error: "Missing wikitext" }, { status: 400 });
    }

    const response = await fetch("https://pub.wiki/api.php?action=parse&format=json", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        text: wikitext,
        contentmodel: "wikitext",
      }).toString(),
    });

    if (!response.ok) {
      return NextResponse.json({ error: "Failed to fetch from MediaWiki API" }, { status: 500 });
    }

    const data = await response.json();
    const html = data?.parse?.text?.["*"] || "";

    return NextResponse.json({ html });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
