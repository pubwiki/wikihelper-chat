import { WIKIFRAM_ENDPOINT } from "@/lib/constants";
import { NextRequest } from "next/server";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ task_id: string }> }
) {
  const { task_id } = await params;

  const backendUrl = `${WIKIFRAM_ENDPOINT}provisioner/v1/tasks/${task_id}/events`;
  const searchParams = req.nextUrl.searchParams;
  const reqcookie = searchParams.get("reqcookie");

  try {
    const backendRes = await fetch(backendUrl, {
      method: "GET",
      headers: {
        Accept: "text/event-stream",
        Cookie: reqcookie ? decodeURIComponent(reqcookie) : "",
      },
    });

    if (!backendRes.ok || !backendRes.body) {
      return new Response("Failed to connect to backend SSE", { status: 502 });
    }

    // 🔁 创建一个 TransformStream，保持长连接
    const { readable, writable } = new TransformStream();
    const writer = writable.getWriter();
    const reader = backendRes.body.getReader();

    (async () => {
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          console.log("SSE Proxy Stream Chunk:", new TextDecoder().decode(value));
          await writer.write(value);
        }
      } catch (err) {
        console.error("SSE proxy stream error:", err);
      } finally {
        await writer.close();
      }
    })();

    return new Response(readable, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
      },
    });
  } catch (err) {
    console.error("SSE Proxy Error:", err);
    return new Response("Internal SSE Proxy Error", { status: 500 });
  }
}
