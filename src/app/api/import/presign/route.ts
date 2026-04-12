/**
 * Presigned R2 upload — generates a presigned PUT URL for large file imports.
 *
 * Flow:
 *   1. Browser calls POST /api/import/presign with file metadata
 *   2. Server generates a presigned PUT URL to Cloudflare R2
 *   3. Browser uploads directly to R2 using the presigned URL
 *   4. After upload, browser calls tRPC import.queueLargeFile to trigger
 *      the Trigger.dev excel-import-large job
 *
 * Auth: Clerk JWT — userId is extracted from the session via auth().
 * Max file size: 50MB.
 * URL expires after 5 minutes.
 */
import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await req.json()) as {
    fileName: string;
    fileSize: number;
    contentType: string;
  };

  if (!body.fileName || !body.fileSize) {
    return NextResponse.json({ error: "Missing fileName or fileSize" }, { status: 400 });
  }

  if (body.fileSize > 50 * 1024 * 1024) {
    return NextResponse.json(
      { error: "Dosya boyutu 50MB'ı aşamaz." },
      { status: 400 }
    );
  }

  const accountId = process.env.CLOUDFLARE_R2_ACCOUNT_ID;
  const accessKeyId = process.env.CLOUDFLARE_R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY;
  const bucketName = process.env.CLOUDFLARE_R2_BUCKET_NAME;

  if (!accountId || !accessKeyId || !secretAccessKey || !bucketName) {
    console.error("R2 env vars not configured for presigned upload");
    return NextResponse.json(
      { error: "R2 yapılandırılmamış. Yöneticinize başvurun." },
      { status: 500 }
    );
  }

  const s3 = new S3Client({
    region: "auto",
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId,
      secretAccessKey,
    },
  });

  const key = `imports/${userId}/${String(Date.now())}-${body.fileName}`;

  try {
    const url = await getSignedUrl(
      s3,
      new PutObjectCommand({
        Bucket: bucketName,
        Key: key,
        ContentType: body.contentType || "application/octet-stream",
      }),
      { expiresIn: 300 } // 5 minutes
    );

    return NextResponse.json({ url, key });
  } catch (err) {
    console.error("Presigned URL generation failed:", err);
    return NextResponse.json(
      { error: "Presigned URL oluşturulamadı." },
      { status: 500 }
    );
  }
}
