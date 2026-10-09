export type TaskStatus = "belum_dikerjakan" | "dikerjakan" | "selesai";
export type TaskPosition = "drafter" | "admin" | "supervisi";

export type Task = {
  id: string;
  user_id: string;
  project_name: string;
  title: string;
  position: TaskPosition;
  description: string;
  status: TaskStatus;
  completed_at: string | null;
  revision_notes: string;
  revision_date: string | null;
  is_new: boolean;
  needs_revision: boolean;
  created_at: string;
  creator_name?: string;
  creator_profile?: MemberProfileSummary;
};

export type MemberProfileSummary = {
  id: string;
  full_name: string;
  username: string | null;
  avatar_url: string | null;
  bio: string | null;
  is_admin: boolean;
};

export type DirectMessage = {
  id: string;
  conversation_id: string;
  sender_id: string;
  recipient_id: string;
  content: string;
  created_at: string;
  read_at: string | null;
  reply_to_id: string | null;
  attachment_name: string | null;
  attachment_expires_at: string | null;
  attachment_downloaded_at: string | null;
};

export type DirectConversationSummary = {
  id: string;
  other_member: MemberProfileSummary;
  latest_message: DirectMessage | null;
  unread_count: number;
};

export type DirectMessageWithSender = DirectMessage & {
  sender: MemberProfileSummary;
  reply_to?: (Pick<DirectMessage, "id" | "content"> & {
    sender: MemberProfileSummary;
  }) | null;
  reactions: MessageReaction[];
};

export type ChatPhotoAttachment = {
  id: string;
  attachment_name: string | null;
  attachment_expires_at: string | null;
  attachment_downloaded_at: string | null;
};

export type Profile = {
  id: string;
  full_name: string;
  username: string | null;
  avatar_url: string | null;
  email: string;
  bio: string | null;
  avatar_path: string | null;
  updated_at: string;
};

export type ProfileFile = {
  id: string;
  owner_id: string;
  file_name: string;
  content_type: string;
  size_bytes: number;
  created_at: string;
};

export type AdminProfileFile = ProfileFile & {
  owner_name: string;
};

export type ChatMessage = {
  id: string;
  sender_id: string;
  content: string;
  created_at: string;
  reply_to_id: string | null;
  reply_to?: Pick<ChatMessage, "id" | "content"> & {
    sender: MemberProfileSummary;
  } | null;
  sender: MemberProfileSummary;
  reactions: MessageReaction[];
  attachment_name: string | null;
  attachment_expires_at: string | null;
  attachment_downloaded_at: string | null;
};

export type MessageReaction = {
  message_id: string;
  user_id: string;
  emoji: string;
};
