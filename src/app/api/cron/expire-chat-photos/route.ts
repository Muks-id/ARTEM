import { createSupabaseAdminClient } from "@/lib/supabase";
import { NextResponse } from "next/server";
import {
  deleteProfileFileFromGoogleDrive,
  isGoogleDriveFile,
} from "@/lib/google-drive";

const batchSize = 500;

async function expireAttachments(table: "messages" | "direct_messages") {
  const admin = createSupabaseAdminClient();
  let deleted = 0;
  while (true) {
    const { data: rows, error: selectError } = await admin
      .from(table)
      .select("id, attachment_storage_path")
      .not("attachment_storage_path", "is", null)
      .is("attachment_downloaded_at", null)
      .lte("attachment_expires_at", new Date().toISOString())
      .limit(batchSize);
    if (selectError) {
      throw new Error(`Gagal mencari foto kedaluwarsa di ${table}: ${selectError.message}`);
    }
    if (!rows?.length) return deleted;

    const paths = rows
      .map((row) => row.attachment_storage_path)
      .filter((path): path is string => typeof path === "string");
    const drivePaths = paths.filter(isGoogleDriveFile);
    const supabasePaths = paths.filter((path) => !isGoogleDriveFile(path));
    for (let index = 0; index < drivePaths.length; index += 10) {
      await Promise.all(
        drivePaths
          .slice(index, index + 10)
          .map((path) => deleteProfileFileFromGoogleDrive(path)),
      );
    }
    if (supabasePaths.length) {
      const { error: removeError } = await admin.storage
        .from("chat-photos")
        .remove(supabasePaths);
      if (removeError) {
        throw new Error(`Gagal menghapus foto kedaluwarsa: ${removeError.message}`);
      }
    }

    const { error: clearError } = await admin
      .from(table)
      .update({
        attachment_storage_path: null,
        attachment_name: null,
        attachment_expires_at: null,
      })
      .in("id", rows.map((row) => row.id))
      .is("attachment_downloaded_at", null);
    if (clearError) {
      throw new Error(`Foto terhapus, tetapi metadata ${table} gagal diperbarui: ${clearError.message}`);
    }
    deleted += rows.length;
  }
}

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    console.error("CRON_SECRET is not configured for chat-photo cleanup.");
    return NextResponse.json({ error: "Cron cleanup is not configured." }, { status: 500 });
  }
  if (request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  try {
    const [community, direct] = await Promise.all([
      expireAttachments("messages"),
      expireAttachments("direct_messages"),
    ]);
    return NextResponse.json({ deleted: { community, direct } });
  } catch (cause) {
    const message =
      cause instanceof Error ? cause.message : "Unknown attachment cleanup error.";
    console.error(message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
