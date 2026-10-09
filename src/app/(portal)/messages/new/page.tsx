import { redirect } from "next/navigation";
import { getOrCreateDirectConversation } from "@/app/actions";

export default async function NewDirectMessagePage({
  searchParams,
}: {
  searchParams: Promise<{ to?: string }>;
}) {
  const { to } = await searchParams;
  if (!to) redirect("/messages");

  const conversationId = await getOrCreateDirectConversation(to);
  redirect(`/messages/${conversationId}`);
}
