import { NextRequest, NextResponse } from "next/server";
import { S3Client, PutObjectAclCommand } from "@aws-sdk/client-s3";

const s3 = new S3Client({
  region: "nyc3",
  endpoint: process.env.DO_SPACE_ENDPOINT,
  forcePathStyle: false,
  credentials: {
    accessKeyId: process.env.DO_SPACE_KEY!,
    secretAccessKey: process.env.DO_SPACE_SECRET!,
  },
});

export async function POST(req: NextRequest) {
  try {
    const { key } = await req.json();

    // ✅ 校验 key
    if (!/^[a-f0-9]{64}(\.[a-z0-9]+)?$/i.test(key)) {
      return NextResponse.json({ error: "Invalid file name" }, { status: 400 });
    }

    await s3.send(
      new PutObjectAclCommand({
        Bucket: process.env.DO_SPACE_BUCKET!,
        Key: key,
        ACL: "public-read",
      })
    );

    const publicUrl = `${process.env.DO_SPACE_ENDPOINT!.replace(
      /^https?:\/\//,
      "https://"
    )}/${process.env.DO_SPACE_BUCKET}/${key}`;

    return NextResponse.json({ publicUrl });
  } catch (err) {
    console.error("Set ACL error:", err);
    return NextResponse.json({ error: "Failed to set object ACL" }, { status: 500 });
  }
}