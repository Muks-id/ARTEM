import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { createSupabaseAdminClient, isAdminUser } from "@/lib/supabase";
import {
  downloadProfileFileFromGoogleDrive,
  isGoogleDriveFile,
} from "@/lib/google-drive";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ fileId: string }> },
) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Silakan masuk." }, { status: 401 });
  }

  const { fileId } = await params;
  const admin = createSupabaseAdminClient();
  const { data: file, error } = await admin
    .from("profile_files")
    .select("owner_id, storage_path, file_name, content_type")
    .eq("id", fileId)
    .maybeSingle();
  if (error || !file) {
    return NextResponse.json({ error: "File tidak ditemukan." }, { status: 404 });
  }
  if (file.owner_id !== userId && !isAdminUser(userId)) {
    return NextResponse.json({ error: "Akses ditolak." }, { status: 403 });
  }

  const download = new URL(request.url).searchParams.get("download") === "1";
  if (isGoogleDriveFile(file.storage_path)) {
    try {
      const driveFile = await downloadProfileFileFromGoogleDrive(file.storage_path);
      const disposition = download ? "attachment" : "inline";
      return new Response(driveFile.body, {
        headers: {
          "Cache-Control": "private, no-store",
          "Content-Disposition": `${disposition}; filename*=UTF-8''${encodeURIComponent(file.file_name)}`,
          "Content-Type": file.content_type,
          "X-Content-Type-Options": "nosniff",
        },
      });
    } catch (cause) {
      console.error("Gagal mengambil file profil dari Google Drive:", cause);
      return NextResponse.json(
        { error: "File Google Drive tidak dapat dibuka." },
        { status: 502 },
      );
    }
  }

  const { data: signed, error: signError } = await admin.storage
    .from("profile-private-files")
    .createSignedUrl(file.storage_path, 60, {
      download: download ? file.file_name : false,
    });
  if (signError) {
    return NextResponse.json({ error: "File tidak dapat dibuka." }, { status: 404 });
  }

  return NextResponse.redirect(signed.signedUrl, {
    headers: { "Cache-Control": "private, no-store" },
  });
}