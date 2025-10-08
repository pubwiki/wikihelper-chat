import { NextResponse } from "next/server";
export function middleware(req: Request) {
  const url = new URL(req.url);
  console.log(
    `Received request for [${req.method}] ${url.pathname}${url.search}`
  );
  return NextResponse.next();
}
