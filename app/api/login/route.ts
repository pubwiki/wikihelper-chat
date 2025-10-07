import { NextRequest, NextResponse } from "next/server";
import fetch from "node-fetch";
import crypto from "crypto";
import { API_BACKEND } from "@/lib/constants";

function getRetCookie(setCookieHeaders: string[] | string | null, cookies: string[]) {
  if (!setCookieHeaders) return cookies;

  const cookiesArray = Array.isArray(setCookieHeaders)
    ? setCookieHeaders
    : [setCookieHeaders];

  for (const cookieString of cookiesArray) {
    const cookie = cookieString.split(";")[0];
    const [name] = cookie.split("=");

    // 去重
    cookies = cookies.filter((c) => !c.startsWith(name + "="));
    cookies.push(cookie);
  }
  return cookies;
}

// 解析 cookies 数组为 key-value 对象
function parseCookies(cookies: string[]): Record<string, string> {
  const result: Record<string, string> = {};
  for (const c of cookies) {
    const [name, ...rest] = c.split("=");
    result[name] = rest.join("="); // 保证 value 不丢
  }
  return result;
}

export async function POST(req: NextRequest) {
  try {
    const { username, password } = await req.json();

    if (!username || !password) {
      return NextResponse.json({ error: "Missing username or password" }, { status: 400 });
    }

    const loginUrl = `${API_BACKEND}api.php?action=query&format=json&meta=tokens&type=login`;
    const loginHeaders = {
      "User-Agent": "mediawiki-mcp-server/1.0.1",
      "Content-Type": "application/x-www-form-urlencoded",
    };

    // 第一步：获取 login token
    const loginRep = await fetch(loginUrl, { method: "POST", headers: loginHeaders });
    const loginData = (await loginRep.json()) as any;
    const loginToken = loginData.query?.tokens?.logintoken;

    if (!loginToken) {
      return NextResponse.json({ error: "Failed to get login token" }, { status: 500 });
    }

    let cookies: string[] = [];
    cookies = getRetCookie((loginRep.headers as any).raw()["set-cookie"], cookies);

    // 第二步：clientlogin
    const clientLoginRep = await fetch(`${API_BACKEND}api.php`, {
      method: "POST",
      headers: {
        ...loginHeaders,
        Cookie: cookies.join("; "),
      },
      body: new URLSearchParams({
        action: "clientlogin",
        username,
        password,
        logintoken: loginToken,
        loginreturnurl: `${API_BACKEND}`,
        rememberMe: "true",
        format: "json",
      }),
    });

    const clientLoginData = await clientLoginRep.json() as any;
    cookies = getRetCookie((clientLoginRep.headers as any).raw()["set-cookie"], cookies);

    if (clientLoginData?.clientlogin?.status !== "PASS") {
      return NextResponse.json(
        {
          success: false,
          message: clientLoginData?.clientlogin?.message || "Login failed",
        },
        { status: 401 }
      );
    }

    // ✅ 登录成功后，检查必须的 cookie
    const cookieMap = parseCookies(cookies);
    if (!cookieMap["pubwikiUserID"] || !cookieMap["pubwikiUserName"] || !cookieMap["pubwiki_session"]) {
      return NextResponse.json(
        { error: "Missing required cookies from server response" },
        { status: 500 }
      );
    }

    // 生成 userkey（salt + hash）
    const salt = process.env.USERKEY_SALT || "+pubwiki_salt"; 
    const userkey = crypto
      .createHash("sha256")
      .update(cookieMap["pubwikiUserName"] + salt)
      .digest("hex");

    return NextResponse.json({
      success: true,
      cookies,
      userkey,
    });
  } catch (error: any) {
    console.error("Login error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
