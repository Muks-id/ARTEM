import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import {
  downloadProfileFileFromGoogleDrive,
  isGoogleDriveFile,
} from "@/lib/google-drive";
import { createSupabaseAdminClient } from "@/lib/supabase";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ userId: string }> },
) {
  const { userId: viewerId } = await auth();
  if (!viewerId) {
    return NextResponse.json({ error: "Silakan masuk." }, { status: 401 });
  }

  const { userId } = await params;
  const { data: profile, error } = await createSupabaseAdminClient()
    .from("profiles")
    .select("avatar_path")
    .eq("id", userId)
    .maybeSingle();
  if (error || !profile?.avatar_path || !isGoogleDriveFile(profile.avatar_path)) {
    return NextResponse.json({ error: "Foto profil tidak ditemukan." }, { status: 404 });
  }

  try {
    const image = await downloadProfileFileFromGoogleDrive(profile.avatar_path);
    return new Response(image.body, {
      headers: {
        "Cache-Control": "private, no-store",
        "Content-Type": image.headers.get("content-type") ?? "application/octet-stream",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (cause) {
    console.error("Gagal mengambil foto profil dari Google Drive:", cause);
    return NextResponse.json(
      { error: "Foto profil tidak dapat dibuka." },
      { status: 502 },
    );
  }
}
