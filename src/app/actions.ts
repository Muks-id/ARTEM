"use server";

import { auth } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";
import type { TaskPosition, TaskStatus } from "@/lib/portal-types";
import {
  deleteProfileFileFromGoogleDrive,
  isGoogleDriveFile,
  uploadProfileFileToGoogleDrive,
} from "@/lib/google-drive";
import {
  createSupabaseAdminClient,
  createSupabaseServerClient,
  isAdminUser,
} from "@/lib/supabase";

const taskStatuses: TaskStatus[] = [
  "belum_dikerjakan",
  "dikerjakan",
  "selesai",
];
const taskPositions: TaskPosition[] = ["drafter", "admin", "supervisi"];

async function getUserClient() {
  const { userId } = await auth();
  if (!userId) throw new Error("Silakan masuk untuk melanjutkan.");
  return { userId, supabase: await createSupabaseServerClient() };
}

const chatPhotoBucket = "chat-photos";
const chatPhotoMaxBytes = 4 * 1024 * 1024;
const profilePrivateFileMaxBytes = 4 * 1024 * 1024;
const profilePrivateFileTypes: Record<string, string> = {
  "application/pdf": "pdf",
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};
const chatPhotoMimeTypes: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
};

async function uploadChatPhoto(file: FormDataEntryValue | null) {
  if (!(file instanceof File) || file.size === 0) return null;
  const extension = chatPhotoMimeTypes[file.type];
  if (!extension) {
    throw new Error("Pilih foto berformat JPG, PNG, WEBP, atau GIF.");
  }
  if (file.size > chatPhotoMaxBytes) {
    throw new Error("Ukuran foto maksimal 4 MB.");
  }
  const signature = new Uint8Array(await file.slice(0, 12).arrayBuffer());
  const validSignature =
    (file.type === "image/jpeg" &&
      signature[0] === 0xff &&
      signature[1] === 0xd8 &&
      signature[2] === 0xff) ||
    (file.type === "image/png" &&
      signature[0] === 0x89 &&
      signature[1] === 0x50 &&
      signature[2] === 0x4e &&
      signature[3] === 0x47) ||
    (file.type === "image/gif" &&
      signature[0] === 0x47 &&
      signature[1] === 0x49 &&
      signature[2] === 0x46) ||
    (file.type === "image/webp" &&
      signature[0] === 0x52 &&
      signature[1] === 0x49 &&
      signature[2] === 0x46 &&
      signature[3] === 0x46 &&
      signature[8] === 0x57 &&
      signature[9] === 0x45 &&
      signature[10] === 0x42 &&
      signature[11] === 0x50);
  if (!validSignature) {
    throw new Error("Isi file tidak sesuai dengan format gambar yang dipilih.");
  }

  const safeName = (file.name.split(/[\\/]/).pop() ?? `foto.${extension}`)
    .replace(/[\u0000-\u001f\u007f]/g, "")
    .trim()
    .slice(0, 180) || `foto.${extension}`;
  const storagePath = await uploadProfileFileToGoogleDrive(file, safeName);

  return {
    storagePath,
    name: safeName,
    expiresAt: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
  };
}

async function removeUploadedChatPhoto(storagePath: string) {
  if (isGoogleDriveFile(storagePath)) {
    await deleteProfileFileFromGoogleDrive(storagePath);
    return;
  }
  const { error } = await createSupabaseAdminClient()
    .storage.from(chatPhotoBucket).remove([storagePath]);
  if (error) throw new Error(`Foto yatim gagal dibersihkan: ${error.message}`);
}

function readChatMessageInput(formData: FormData) {
  const content = String(formData.get("content") ?? "").trim();
  const replyToId = String(formData.get("replyToId") ?? "").trim() || null;
  if (content.length > 2000) {
    throw new Error("Pesan maksimal 2000 karakter.");
  }
  return { content, replyToId, photo: formData.get("photo") };
}

export async function sendCommunityMessage(formData: FormData) {
  const { userId, supabase } = await getUserClient();
  const input = readChatMessageInput(formData);
  if (!input.content && !(input.photo instanceof File && input.photo.size > 0)) {
    throw new Error("Tulis pesan atau pilih foto terlebih dahulu.");
  }
  const photo = await uploadChatPhoto(input.photo);
  const { data, error } = await supabase
    .from("messages")
    .insert({
      sender_id: userId,
      content: input.content || "📷 Foto",
      reply_to_id: input.replyToId,
      attachment_storage_path: photo?.storagePath ?? null,
      attachment_name: photo?.name ?? null,
      attachment_expires_at: photo?.expiresAt ?? null,
    })
    .select("id")
    .single();
  if (error) {
    if (photo) await removeUploadedChatPhoto(photo.storagePath);
    throw new Error(`Pesan gagal dikirim: ${error.message}`);
  }
  revalidatePath("/chat");
  return data;
}

export async function sendDirectMessage(formData: FormData) {
  const { userId, supabase } = await getUserClient();
  const input = readChatMessageInput(formData);
  const conversationId = String(formData.get("conversationId") ?? "").trim();
  if (!conversationId) throw new Error("Percakapan tidak valid.");
  if (!input.content && !(input.photo instanceof File && input.photo.size > 0)) {
    throw new Error("Tulis pesan atau pilih foto terlebih dahulu.");
  }

  const { data: conversation, error: conversationError } = await supabase
    .from("direct_conversations")
    .select("id, member_one_id, member_two_id")
    .eq("id", conversationId)
    .maybeSingle();
  if (conversationError) {
    throw new Error(`Gagal memeriksa percakapan: ${conversationError.message}`);
  }
  if (
    !conversation ||
    (conversation.member_one_id !== userId &&
      conversation.member_two_id !== userId)
  ) {
    throw new Error("Percakapan tidak ditemukan atau Anda bukan anggotanya.");
  }
  const recipientId =
    conversation.member_one_id === userId
      ? conversation.member_two_id
      : conversation.member_one_id;
  const photo = await uploadChatPhoto(input.photo);
  const { data, error } = await supabase
    .from("direct_messages")
    .insert({
      conversation_id: conversationId,
      sender_id: userId,
      recipient_id: recipientId,
      content: input.content || "📷 Foto",
      reply_to_id: input.replyToId,
      attachment_storage_path: photo?.storagePath ?? null,
      attachment_name: photo?.name ?? null,
      attachment_expires_at: photo?.expiresAt ?? null,
    })
    .select("id, conversation_id, sender_id, recipient_id, content, created_at, read_at, reply_to_id, attachment_name, attachment_expires_at, attachment_downloaded_at")
    .single();
  if (error) {
    if (photo) await removeUploadedChatPhoto(photo.storagePath);
    throw new Error(`Pesan gagal dikirim: ${error.message}`);
  }
  revalidatePath(`/messages/${conversationId}`);
  revalidatePath("/messages");
  return data;
}

async function getAccessibleChatPhoto(messageId: string, isDirect: boolean) {
  const { userId, supabase } = await getUserClient();
  if (isDirect) {
    const { data, error } = await supabase
      .from("direct_messages")
      .select("attachment_storage_path, attachment_expires_at, attachment_downloaded_at")
      .eq("id", messageId)
      .maybeSingle();
    if (error) throw new Error(`Gagal memeriksa foto: ${error.message}`);
    if (!data) throw new Error("Foto tidak ditemukan atau Anda tidak memiliki akses.");
    const { data: hidden, error: hiddenError } = await supabase
      .from("direct_message_hides")
      .select("message_id")
      .eq("message_id", messageId)
      .eq("user_id", userId)
      .maybeSingle();
    if (hiddenError) {
      throw new Error(`Gagal memeriksa visibilitas foto: ${hiddenError.message}`);
    }
    if (hidden) throw new Error("Pesan foto ini telah disembunyikan dari inbox Anda.");
    return { userId, supabase, data, isDirect };
  }
  const { data, error } = await supabase
    .from("messages")
    .select("attachment_storage_path, attachment_expires_at, attachment_downloaded_at")
    .eq("id", messageId)
    .maybeSingle();
  if (error) throw new Error(`Gagal memeriksa foto: ${error.message}`);
  if (!data) throw new Error("Foto tidak ditemukan atau Anda tidak memiliki akses.");
  return { userId, supabase, data, isDirect };
}

export async function getChatPhotoPreviewUrl(messageId: string, isDirect: boolean) {
  const { data } = await getAccessibleChatPhoto(messageId, isDirect);
  if (!data.attachment_storage_path) {
    throw new Error("Foto ini sudah dihapus atau tidak tersedia.");
  }
  if (
    !data.attachment_downloaded_at &&
    data.attachment_expires_at &&
    Date.now() > Date.parse(data.attachment_expires_at)
  ) {
    throw new Error("Foto sudah kedaluwarsa setelah 3 hari.");
  }
  if (isGoogleDriveFile(data.attachment_storage_path)) {
    return `/api/chat-photos/${encodeURIComponent(messageId)}?direct=${isDirect ? "1" : "0"}`;
  }
  const { data: signed, error } = await createSupabaseAdminClient()
    .storage.from(chatPhotoBucket)
    .createSignedUrl(data.attachment_storage_path, 120);
  if (error) throw new Error(`Foto gagal ditampilkan: ${error.message}`);
  return signed.signedUrl;
}

export async function downloadChatPhoto(messageId: string, isDirect: boolean) {
  const { data, isDirect: direct } = await getAccessibleChatPhoto(messageId, isDirect);
  if (!data.attachment_storage_path) {
    throw new Error("Foto ini sudah dihapus atau tidak tersedia.");
  }
  if (
    !data.attachment_downloaded_at &&
    data.attachment_expires_at &&
    Date.now() > Date.parse(data.attachment_expires_at)
  ) {
    throw new Error("Foto sudah kedaluwarsa setelah 3 hari.");
  }
  let downloadUrl: string;
  if (isGoogleDriveFile(data.attachment_storage_path)) {
    downloadUrl = `/api/chat-photos/${encodeURIComponent(messageId)}?direct=${direct ? "1" : "0"}&download=1`;
  } else {
    const { data: signed, error: signError } = await createSupabaseAdminClient()
      .storage.from(chatPhotoBucket)
      .createSignedUrl(data.attachment_storage_path, 60, {
        download: true,
      });
    if (signError) throw new Error(`Link unduhan gagal dibuat: ${signError.message}`);
    downloadUrl = signed.signedUrl;
  }

  const admin = createSupabaseAdminClient();
  const table = direct ? "direct_messages" : "messages";
  const { error: updateError } = await admin
    .from(table)
    .update({ attachment_downloaded_at: new Date().toISOString() })
    .eq("id", messageId)
    .is("attachment_downloaded_at", null);
  if (updateError) {
    throw new Error(`Status unduhan foto gagal disimpan: ${updateError.message}`);
  }
  return downloadUrl;
}

export async function createTask(input: {
  projectName: string;
  title: string;
  position: TaskPosition;
  description: string;
  status: TaskStatus;
  revisionNotes: string;
  revisionDate: string | null;
  isNew: boolean;
  needsRevision: boolean;
}) {
  const projectName = input.projectName.trim();
  const title = input.title.trim();
  if (!projectName || projectName.length > 160) {
    throw new Error("Nama proyek wajib diisi dan maksimal 160 karakter.");
  }
  if (!title || title.length > 160) {
    throw new Error("Judul wajib diisi dan maksimal 160 karakter.");
  }
  if (!taskStatuses.includes(input.status)) throw new Error("Status task tidak valid.");
  if (!taskPositions.includes(input.position)) throw new Error("Posisi task tidak valid.");
  if (typeof input.isNew !== "boolean" || typeof input.needsRevision !== "boolean") {
    throw new Error("Checklist Baru/Revisi tidak valid.");
  }
  if (input.revisionDate && !/^\d{4}-\d{2}-\d{2}$/.test(input.revisionDate)) {
    throw new Error("Tanggal revisi tidak valid.");
  }

  const { userId, supabase } = await getUserClient();
  const { error } = await supabase.from("tasks").insert({
    user_id: userId,
    project_name: projectName,
    title,
    position: input.position,
    description: input.description.trim(),
    status: input.status,
    completed_at: input.status === "selesai" ? new Date().toISOString() : null,
    revision_notes: input.revisionNotes.trim(),
    revision_date: input.revisionDate || null,
    is_new: input.isNew,
    needs_revision: input.needsRevision,
  });
  if (error) throw new Error(`Gagal membuat task: ${error.message}`);
}

export async function updateTask(
  id: string,
  input: {
    projectName: string;
    title: string;
    position: TaskPosition;
    description: string;
    status: TaskStatus;
    revisionNotes: string;
    revisionDate: string | null;
    isNew: boolean;
    needsRevision: boolean;
  },
) {
  const projectName = input.projectName.trim();
  const title = input.title.trim();
  if (!projectName || projectName.length > 160) {
    throw new Error("Nama proyek wajib diisi dan maksimal 160 karakter.");
  }
  if (!title || title.length > 160) {
    throw new Error("Judul wajib diisi dan maksimal 160 karakter.");
  }
  if (!taskStatuses.includes(input.status)) throw new Error("Status task tidak valid.");
  if (!taskPositions.includes(input.position)) throw new Error("Posisi task tidak valid.");
  if (typeof input.isNew !== "boolean" || typeof input.needsRevision !== "boolean") {
    throw new Error("Checklist Baru/Revisi tidak valid.");
  }
  if (input.revisionDate && !/^\d{4}-\d{2}-\d{2}$/.test(input.revisionDate)) {
    throw new Error("Tanggal revisi tidak valid.");
  }

  const { userId, supabase } = await getUserClient();
  const { data: existingTask, error: readError } = await supabase
    .from("tasks")
    .select("completed_at")
    .eq("id", id)
    .eq("user_id", userId)
    .maybeSingle();
  if (readError) throw new Error(`Gagal memeriksa task: ${readError.message}`);
  if (!existingTask) throw new Error("Task tidak ditemukan atau bukan milik akun ini.");

  const { data, error } = await supabase
    .from("tasks")
    .update({
      project_name: projectName,
      title,
      position: input.position,
      description: input.description.trim(),
      status: input.status,
      completed_at:
        input.status === "selesai"
          ? existingTask.completed_at ?? new Date().toISOString()
          : null,
      revision_notes: input.revisionNotes.trim(),
      revision_date: input.revisionDate || null,
      is_new: input.isNew,
      needs_revision: input.needsRevision,
    })
    .eq("id", id)
    .eq("user_id", userId)
    .select("id, completed_at")
    .maybeSingle();
  if (error) throw new Error(`Gagal memperbarui task: ${error.message}`);
  if (!data) throw new Error("Task tidak ditemukan atau bukan milik akun ini.");
  return data.completed_at as string | null;
}

export async function deleteTask(id: string) {
  const { userId } = await auth();
  if (!userId) throw new Error("Silakan masuk untuk melanjutkan.");
  if (!isAdminUser(userId)) throw new Error("Hanya admin yang dapat menghapus task.");

  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("tasks")
    .delete()
    .eq("id", id)
    .select("id")
    .maybeSingle();
  if (error) throw new Error(`Gagal menghapus task: ${error.message}`);
  if (!data) throw new Error("Task tidak ditemukan.");
}

export async function getOrCreateDirectConversation(otherMemberId: string) {
  const { userId, supabase } = await getUserClient();
  if (
    typeof otherMemberId !== "string" ||
    !otherMemberId.trim() ||
    otherMemberId === userId
  ) {
    throw new Error("Pilih anggota lain untuk memulai chat pribadi.");
  }

  const [memberOneId, memberTwoId] =
    userId < otherMemberId ? [userId, otherMemberId] : [otherMemberId, userId];

  const findConversation = () =>
    supabase
      .from("direct_conversations")
      .select("id")
      .eq("member_one_id", memberOneId)
      .eq("member_two_id", memberTwoId)
      .maybeSingle();

  const { data: existing, error: findError } = await findConversation();
  if (findError) {
    throw new Error(`Gagal mencari chat pribadi: ${findError.message}`);
  }
  if (existing) return existing.id as string;

  const { data: created, error: createError } = await supabase
    .from("direct_conversations")
    .insert({ member_one_id: memberOneId, member_two_id: memberTwoId })
    .select("id")
    .maybeSingle();
  if (!createError && created) {
    revalidatePath("/messages");
    return created.id as string;
  }

  if (createError?.code === "23505") {
    const { data: concurrentConversation, error: retryError } =
      await findConversation();
    if (retryError) {
      throw new Error(`Gagal memuat chat pribadi: ${retryError.message}`);
    }
    if (concurrentConversation) return concurrentConversation.id as string;
  }

  throw new Error(
    `Gagal membuat chat pribadi: ${createError?.message ?? "percakapan tidak tersimpan."}`,
  );
}

export async function hideDirectMessage(messageId: string) {
  const { userId, supabase } = await getUserClient();
  if (typeof messageId !== "string" || !messageId.trim()) {
    throw new Error("Pesan yang akan dihapus tidak valid.");
  }
  const { error } = await supabase
    .from("direct_message_hides")
    .insert({ message_id: messageId, user_id: userId });
  if (error && error.code !== "23505") {
    throw new Error(`Gagal menghapus pesan dari tampilan Anda: ${error.message}`);
  }
  revalidatePath("/messages");
}

export async function hideAllDirectMessages(conversationId: string) {
  const { userId, supabase } = await getUserClient();
  const normalizedId =
    typeof conversationId === "string" ? conversationId.trim() : "";
  if (!normalizedId) throw new Error("Percakapan yang akan dibersihkan tidak valid.");

  const { data: conversation, error: conversationError } = await supabase
    .from("direct_conversations")
    .select("id")
    .eq("id", normalizedId)
    .maybeSingle();
  if (conversationError) {
    throw new Error(`Gagal memeriksa percakapan: ${conversationError.message}`);
  }
  if (!conversation) {
    throw new Error("Percakapan tidak ditemukan atau Anda bukan anggotanya.");
  }

  const messageIds: string[] = [];
  const pageSize = 500;
  for (let offset = 0; ; offset += pageSize) {
    const { data, error } = await supabase
      .from("direct_messages")
      .select("id")
      .eq("conversation_id", normalizedId)
      .order("created_at", { ascending: true })
      .range(offset, offset + pageSize - 1);
    if (error) {
      throw new Error(`Gagal memuat riwayat chat untuk dibersihkan: ${error.message}`);
    }
    messageIds.push(...(data ?? []).map((message) => message.id));
    if (!data || data.length < pageSize) break;
  }

  for (let offset = 0; offset < messageIds.length; offset += pageSize) {
    const hiddenMessages = messageIds
      .slice(offset, offset + pageSize)
      .map((messageId) => ({ message_id: messageId, user_id: userId }));
    const { error } = await supabase
      .from("direct_message_hides")
      .upsert(hiddenMessages, {
        onConflict: "message_id,user_id",
        ignoreDuplicates: true,
      });
    if (error) {
      throw new Error(`Gagal menyembunyikan riwayat chat: ${error.message}`);
    }
  }

  revalidatePath(`/messages/${normalizedId}`);
  revalidatePath("/messages");
}

export async function deleteOwnDirectMessage(messageId: string) {
  const { userId, supabase } = await getUserClient();
  const normalizedId = typeof messageId === "string" ? messageId.trim() : "";
  if (!normalizedId) throw new Error("Pesan yang akan dihapus tidak valid.");

  const { data: message, error: readError } = await supabase
    .from("direct_messages")
    .select("id, conversation_id, sender_id, attachment_storage_path")
    .eq("id", normalizedId)
    .maybeSingle();
  if (readError) throw new Error(`Gagal memeriksa pesan pribadi: ${readError.message}`);
  if (!message || message.sender_id !== userId) {
    throw new Error("Anda hanya dapat menghapus pesan pribadi yang Anda kirim.");
  }

  const admin = createSupabaseAdminClient();
  const { error: deleteError } = await admin
    .from("direct_messages")
    .delete()
    .eq("id", normalizedId)
    .eq("sender_id", userId);
  if (deleteError) {
    throw new Error(`Pesan pribadi gagal dihapus: ${deleteError.message}`);
  }

  if (message.attachment_storage_path) {
    try {
      await removeUploadedChatPhoto(message.attachment_storage_path);
    } catch (storageError) {
      throw new Error(
        `Pesan sudah dihapus, tetapi file fotonya gagal dibersihkan: ${storageError instanceof Error ? storageError.message : "kesalahan tidak diketahui"}`,
      );
    }
  }
  revalidatePath(`/messages/${message.conversation_id}`);
  revalidatePath("/messages");
}

export async function deleteCommunityMessage(messageId: string) {
  const { userId } = await getUserClient();
  if (!isAdminUser(userId)) {
    throw new Error("Hanya admin yang dapat menghapus pesan di Chat Room.");
  }
  const normalizedId = typeof messageId === "string" ? messageId.trim() : "";
  if (!normalizedId) throw new Error("Pesan yang akan dihapus tidak valid.");

  const admin = createSupabaseAdminClient();
  const { data: message, error: readError } = await admin
    .from("messages")
    .select("id, attachment_storage_path")
    .eq("id", normalizedId)
    .maybeSingle();
  if (readError) throw new Error(`Gagal memeriksa pesan Chat Room: ${readError.message}`);
  if (!message) throw new Error("Pesan Chat Room tidak ditemukan.");

  const { error: deleteError } = await admin
    .from("messages")
    .delete()
    .eq("id", normalizedId);
  if (deleteError) {
    throw new Error(`Pesan Chat Room gagal dihapus: ${deleteError.message}`);
  }
  if (message.attachment_storage_path) {
    try {
      await removeUploadedChatPhoto(message.attachment_storage_path);
    } catch (storageError) {
      throw new Error(
        `Pesan sudah dihapus, tetapi file fotonya gagal dibersihkan: ${storageError instanceof Error ? storageError.message : "kesalahan tidak diketahui"}`,
      );
    }
  }
  revalidatePath("/chat");
}

export async function markDirectConversationRead(conversationId: string) {
  const { userId, supabase } = await getUserClient();
  if (typeof conversationId !== "string" || !conversationId.trim()) {
    throw new Error("Percakapan yang akan ditandai telah dilihat tidak valid.");
  }
  const { error } = await supabase
    .from("direct_messages")
    .update({ read_at: new Date().toISOString() })
    .eq("conversation_id", conversationId)
    .eq("recipient_id", userId)
    .is("read_at", null);
  if (error) {
    throw new Error(`Gagal menandai pesan telah dilihat: ${error.message}`);
  }
  revalidatePath("/messages");
}

export async function markCommunityChatRead() {
  const { userId, supabase } = await getUserClient();
  const { error } = await supabase.from("community_chat_reads").upsert(
    {
      user_id: userId,
      last_read_at: new Date().toISOString(),
    },
    { onConflict: "user_id" },
  );
  if (error) {
    throw new Error(`Gagal memperbarui status baca chat room: ${error.message}`);
  }
  revalidatePath("/chat");
}

export async function updateProfile(input: {
  fullName: string;
  username: string;
  bio: string;
}) {
  const fullName = input.fullName.trim();
  const username = input.username.trim().replace(/^@/, "");
  if (!fullName || fullName.length > 100) {
    throw new Error("Nama wajib diisi dan maksimal 100 karakter.");
  }
  if (!/^[a-zA-Z0-9_.-]{3,30}$/.test(username)) {
    throw new Error("Username harus 3–30 karakter: huruf, angka, titik, _ atau -.");
  }
  if (input.bio.length > 240) throw new Error("Bio maksimal 240 karakter.");

  const { userId, supabase } = await getUserClient();
  const { data, error } = await supabase
    .from("profiles")
    .update({ full_name: fullName, username, bio: input.bio.trim() })
    .eq("id", userId)
    .select("id")
    .maybeSingle();
  if (error) {
    if (error.code === "23505") throw new Error("Username ini sudah digunakan.");
    throw new Error(`Gagal memperbarui profil: ${error.message}`);
  }
  if (!data) throw new Error("Profil tidak ditemukan untuk akun ini.");
}

export async function uploadProfilePhoto(formData: FormData) {
  const { userId, supabase } = await getUserClient();
  const photo = formData.get("photo");

  if (!(photo instanceof File) || photo.size === 0) {
    throw new Error("Pilih foto yang akan diunggah.");
  }
  if (photo.size > 4 * 1024 * 1024) {
    throw new Error("Ukuran foto maksimal 4 MB.");
  }

  const extensions: Record<string, string> = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
  };
  const extension = extensions[photo.type];
  if (!extension) {
    throw new Error("Format foto harus JPEG, PNG, atau WebP.");
  }

  const { data: currentProfile, error: readError } = await supabase
    .from("profiles")
    .select("avatar_path")
    .eq("id", userId)
    .maybeSingle();
  if (readError) throw new Error(`Gagal membaca profil: ${readError.message}`);
  if (!currentProfile) throw new Error("Profil tidak ditemukan.");

  const path = await uploadProfileFileToGoogleDrive(
    photo,
    `avatar-${userId}.${extension}`,
  );
  const avatarUrl = `/api/profile-avatars/${encodeURIComponent(userId)}`;
  const { data: updatedProfile, error: updateError } = await supabase
    .from("profiles")
    .update({ avatar_url: avatarUrl, avatar_path: path })
    .eq("id", userId)
    .select("id")
    .maybeSingle();

  if (updateError || !updatedProfile) {
    const reason = updateError?.message ?? "Profil tidak ditemukan.";
    try {
      await deleteProfileFileFromGoogleDrive(path);
    } catch (cleanupError) {
      throw new Error(
        `Gagal menyimpan profil: ${reason}. File foto baru juga gagal dibersihkan: ${cleanupError instanceof Error ? cleanupError.message : "kesalahan tidak diketahui"}`,
      );
    }
    throw new Error(`Gagal menyimpan profil: ${reason}`);
  }

  const oldPath = currentProfile.avatar_path;
  if (oldPath && oldPath !== path) {
    try {
      if (isGoogleDriveFile(oldPath)) {
        await deleteProfileFileFromGoogleDrive(oldPath);
      } else if (oldPath.startsWith(`${userId}/`)) {
        const { error: deleteError } = await supabase.storage
          .from("profile-avatars")
          .remove([oldPath]);
        if (deleteError) throw new Error(deleteError.message);
      }
    } catch (deleteError) {
      throw new Error(
        `Foto baru sudah tersimpan, tetapi foto lama gagal dihapus: ${deleteError instanceof Error ? deleteError.message : "kesalahan tidak diketahui"}`,
      );
    }
  }

  return avatarUrl;
}

export async function uploadPersonalProfileFile(formData: FormData) {
  const { userId } = await getUserClient();
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    throw new Error("Pilih file PDF atau foto yang akan diunggah.");
  }
  if (file.size > profilePrivateFileMaxBytes) {
    throw new Error("Ukuran file maksimal 4 MB.");
  }

  const extension = profilePrivateFileTypes[file.type];
  if (!extension) {
    throw new Error("Format file harus PDF, JPEG, PNG, atau WebP.");
  }
  const signature = new Uint8Array(await file.slice(0, 12).arrayBuffer());
  const validSignature =
    (file.type === "application/pdf" &&
      new TextDecoder().decode(signature.slice(0, 5)) === "%PDF-") ||
    (file.type === "image/jpeg" &&
      signature[0] === 0xff &&
      signature[1] === 0xd8 &&
      signature[2] === 0xff) ||
    (file.type === "image/png" &&
      signature[0] === 0x89 &&
      signature[1] === 0x50 &&
      signature[2] === 0x4e &&
      signature[3] === 0x47) ||
    (file.type === "image/webp" &&
      signature[0] === 0x52 &&
      signature[1] === 0x49 &&
      signature[2] === 0x46 &&
      signature[3] === 0x46 &&
      signature[8] === 0x57 &&
      signature[9] === 0x45 &&
      signature[10] === 0x42 &&
      signature[11] === 0x50);
  if (!validSignature) {
    throw new Error("Isi file tidak sesuai dengan format yang dipilih.");
  }

  const fileName = (file.name.split(/[\\/]/).pop() ?? "file")
    .replace(/[\u0000-\u001f\u007f]/g, "")
    .trim()
    .slice(0, 180) || `file.${extension}`;
  const admin = createSupabaseAdminClient();
  const storagePath = await uploadProfileFileToGoogleDrive(file, fileName);
  const { data, error: insertError } = await admin
    .from("profile_files")
    .insert({
      owner_id: userId,
      storage_path: storagePath,
      file_name: fileName,
      content_type: file.type,
      size_bytes: file.size,
    })
    .select("id, owner_id, file_name, content_type, size_bytes, created_at")
    .single();
  if (insertError) {
    try {
      await deleteProfileFileFromGoogleDrive(storagePath);
    } catch (cleanupError) {
      throw new Error(
        `Data file gagal disimpan: ${insertError.message}. File Google Drive juga gagal dibersihkan: ${cleanupError instanceof Error ? cleanupError.message : "kesalahan tidak diketahui"}`,
      );
    }
    throw new Error(`Data file gagal disimpan: ${insertError.message}`);
  }

  revalidatePath("/profile");
  revalidatePath("/admin");
  return data;
}

export async function deletePersonalProfileFile(fileId: string) {
  const { userId, supabase } = await getUserClient();
  const { data: file, error: readError } = await supabase
    .from("profile_files")
    .select("id, owner_id, storage_path")
    .eq("id", fileId)
    .maybeSingle();
  if (readError) throw new Error(`Gagal memeriksa file: ${readError.message}`);
  if (!file || file.owner_id !== userId) {
    throw new Error("File tidak ditemukan atau Anda tidak memiliki akses.");
  }

  const admin = createSupabaseAdminClient();
  if (isGoogleDriveFile(file.storage_path)) {
    await deleteProfileFileFromGoogleDrive(file.storage_path);
  } else {
    const { error: removeError } = await admin.storage
      .from("profile-private-files")
      .remove([file.storage_path]);
    if (removeError) throw new Error(`File gagal dihapus: ${removeError.message}`);
  }

  const { error: deleteError } = await admin
    .from("profile_files")
    .delete()
    .eq("id", file.id)
    .eq("owner_id", userId);
  if (deleteError) throw new Error(`Data file gagal dihapus: ${deleteError.message}`);

  revalidatePath("/profile");
  revalidatePath("/admin");
}
