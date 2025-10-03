import { NextRequest } from "next/server";

const API_BACKEND = "https://pub.wiki/";

export async function GET(
  req: NextRequest,
  { params }: { params: { task_id: string } }
) {
  const { task_id } = params;

  const backendUrl = `${API_BACKEND}tasks/${task_id}/events`;

  try {
    const backendRes = await fetch(backendUrl, {
      method: "GET",
      headers: {
        Accept: "text/event-stream",
      },
    });

    if (!backendRes.ok || !backendRes.body) {
      return new Response("Failed to connect to backend SSE", { status: 502 });
    }

    // 设置 SSE 响应头
    const headers = new Headers();
    headers.set("Content-Type", "text/event-stream");
    headers.set("Cache-Control", "no-cache");
    headers.set("Connection", "keep-alive");

    // 直接转发 body 流
    return new Response(backendRes.body, { headers });
  } catch (err) {
    console.error("SSE Proxy Error:", err);
    return new Response("Internal SSE Proxy Error", { status: 500 });
  }
}
