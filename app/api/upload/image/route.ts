import { NextRequest, NextResponse } from "next/server";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import crypto from "crypto";

const s3 = new S3Client({
  region: "nyc3", // DO 要求填个 region
  endpoint: process.env.DO_SPACE_ENDPOINT,
  forcePathStyle: false, // Configures to use subdomain/virtual calling format.
  credentials: {
    accessKeyId: process.env.DO_SPACE_KEY!,
    secretAccessKey: process.env.DO_SPACE_SECRET!,
  },
});

export async function POST(req: NextRequest) {
  try {
    const { fileName, fileType } = await req.json();

    // ✅ 校验文件名（64 位 hex + 可选扩展名）
    if (!/^[a-f0-9]{64}(\.[a-z0-9]+)?$/i.test(fileName)) {
      return NextResponse.json({ error: "Invalid file name" }, { status: 400 });
    }

    const command = new PutObjectCommand({
      Bucket: process.env.DO_SPACE_BUCKET!,
      Key: fileName,
      ContentType: fileType,
    });

    const uploadUrl = await getSignedUrl(s3, command, { expiresIn: 60 });

    const publicUrl = `${process.env.DO_SPACE_ENDPOINT!.replace(
      /^https?:\/\//,
      "https://"
    )}/${process.env.DO_SPACE_BUCKET}/${fileName}`;

    return NextResponse.json({ uploadUrl, publicUrl, key: fileName });
  } catch (err) {
    console.error("Upload error:", err);
    return NextResponse.json({ error: "Failed to generate upload URL" }, { status: 500 });
  }
}