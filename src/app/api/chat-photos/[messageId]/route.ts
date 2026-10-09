import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import {
  downloadProfileFileFromGoogleDrive,
  isGoogleDriveFile,
} from "@/lib/google-drive";
import { createSupabaseServerClient } from "@/lib/supabase";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ messageId: string }> },
) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Silakan masuk." }, { status: 401 });
  }

  const { messageId } = await params;
  const query = new URL(request.url).searchParams;
  const isDirect = query.get("direct") === "1";
  const table = isDirect ? "direct_messages" : "messages";
  const supabase = await createSupabaseServerClient();
  const { data: message, error } = await supabase
    .from(table)
    .select("attachment_storage_path, attachment_name, attachment_expires_at, attachment_downloaded_at")
    .eq("id", messageId)
    .maybeSingle();
  if (error || !message) {
    return NextResponse.json({ error: "Foto tidak ditemukan." }, { status: 404 });
  }

  if (isDirect) {
    const { data: hidden, error: hiddenError } = await supabase
      .from("direct_message_hides")
      .select("message_id")
      .eq("message_id", messageId)
      .eq("user_id", userId)
      .maybeSingle();
    if (hiddenError) {
      return NextResponse.json(
        { error: "Visibilitas foto tidak dapat diperiksa." },
        { status: 500 },
      );
    }
    if (hidden) {
      return NextResponse.json({ error: "Foto tidak ditemukan." }, { status: 404 });
    }
  }

  if (
    !message.attachment_storage_path ||
    !isGoogleDriveFile(message.attachment_storage_path)
  ) {
    return NextResponse.json({ error: "Foto tidak ditemukan." }, { status: 404 });
  }
  if (
    !message.attachment_downloaded_at &&
    message.attachment_expires_at &&
    Date.now() > Date.parse(message.attachment_expires_at)
  ) {
    return NextResponse.json({ error: "Foto sudah kedaluwarsa." }, { status: 410 });
  }

  try {
    const image = await downloadProfileFileFromGoogleDrive(
      message.attachment_storage_path,
    );
    const disposition = query.get("download") === "1" ? "attachment" : "inline";
    return new Response(image.body, {
      headers: {
        "Cache-Control": "private, no-store",
        "Content-Disposition": `${disposition}; filename*=UTF-8''${encodeURIComponent(message.attachment_name ?? "foto")}`,
        "Content-Type": image.headers.get("content-type") ?? "application/octet-stream",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (cause) {
    console.error("Gagal mengambil foto chat dari Google Drive:", cause);
    return NextResponse.json(
      { error: "Foto chat tidak dapat dibuka." },
      { status: 502 },
    );
  }
}
