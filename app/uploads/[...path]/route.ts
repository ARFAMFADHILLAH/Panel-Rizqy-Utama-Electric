import { readUploadedImage } from "@/lib/upload";

export const dynamic = "force-dynamic";

type Params = Promise<{ path: string[] }>;

export async function GET(_request: Request, { params }: { params: Params }) {
  const { path: segments } = await params;

  if (!Array.isArray(segments) || segments.length !== 1) {
    return new Response("Not found", { status: 404 });
  }

  const filename = segments[0];
  const result = await readUploadedImage(filename);

  if (!result.ok) {
    return new Response("Not found", { status: 404 });
  }

  return new Response(new Uint8Array(result.bytes), {
    headers: {
      "Content-Type": result.type,
      "Content-Length": String(result.bytes.byteLength),
      "Cache-Control": "public, max-age=31536000, immutable",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
