# Artem Geng: Clerk + Supabase setup

## 1. Configure authentication

1. Create an application in [Clerk Dashboard](https://dashboard.clerk.com/).
2. In Clerk, open [Supabase integration setup](https://dashboard.clerk.com/setup/supabase), activate the Supabase integration, and copy the Clerk domain shown there.
3. In Supabase, open **Authentication → Sign In / Providers → Third-Party Auth**, add **Clerk**, and paste the exact Clerk domain from step 2. If the field is labelled **Domain**, enter only the hostname (for example, `example.clerk.accounts.dev`), without `https://` or a trailing slash. If the dashboard explicitly asks for an **Issuer URL**, use the complete URL shown by Clerk. The domain must belong to the same Clerk instance as `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`.
4. Ensure Clerk session tokens contain the `role: "authenticated"` claim. Clerk's Supabase integration setup configures the required compatibility; if configuring manually, add the `role` claim through Clerk's session-token customization.
5. RLS expects the Clerk user ID in the JWT `sub` claim and the `authenticated` database role.
6. Copy `.env.example` to `.env.local` and set the Clerk publishable/secret keys and Supabase project URL plus an anon key or publishable key (`sb_publishable_...`).

The regular server and browser Supabase clients use the Clerk session token and RLS. The admin panel and chat-photo storage actions use `SUPABASE_SERVICE_ROLE_KEY` only in server-side code. Never expose this key with a `NEXT_PUBLIC_` variable or import the admin client into browser code.

Set `ADMIN_USER_IDS` to one or more Clerk user IDs, separated by commas. Only these IDs see `/admin` and can call the admin delete action. Keep both values in the deployment's server-side environment configuration.

## 2. Create the database

Apply [`supabase/migrations/002_artem_geng_portal.sql`](./supabase/migrations/002_artem_geng_portal.sql), [`supabase/migrations/003_project_tasks_admin.sql`](./supabase/migrations/003_project_tasks_admin.sql), [`supabase/migrations/004_task_revision_checklist.sql`](./supabase/migrations/004_task_revision_checklist.sql), [`supabase/migrations/005_profile_avatar_storage.sql`](./supabase/migrations/005_profile_avatar_storage.sql), [`supabase/migrations/006_chat_reactions_replies.sql`](./supabase/migrations/006_chat_reactions_replies.sql), [`supabase/migrations/007_shared_task_visibility.sql`](./supabase/migrations/007_shared_task_visibility.sql), [`supabase/migrations/008_public_member_bio.sql`](./supabase/migrations/008_public_member_bio.sql), [`supabase/migrations/009_task_position.sql`](./supabase/migrations/009_task_position.sql), [`supabase/migrations/010_direct_messages.sql`](./supabase/migrations/010_direct_messages.sql), [`supabase/migrations/011_direct_message_reactions_replies.sql`](./supabase/migrations/011_direct_message_reactions_replies.sql), [`supabase/migrations/012_community_chat_read_state.sql`](./supabase/migrations/012_community_chat_read_state.sql), [`supabase/migrations/013_chat_photo_attachments.sql`](./supabase/migrations/013_chat_photo_attachments.sql), and [`supabase/migrations/014_fix_direct_message_rls_recursion.sql`](./supabase/migrations/014_fix_direct_message_rls_recursion.sql) in the Supabase SQL Editor or with the Supabase CLI:

```sh
supabase db push
```

The migrations create `profiles`, `tasks`, and community `messages`, indexes, profile timestamp trigger, Clerk-based RLS policies, and add chat tables to the `supabase_realtime` publication. Tasks have project name, work item, position (Drafter/Admin/Supervisi), status, completion date, revision note/date, and independent Baru/Revisi checklist flags. All signed-in members can read every task; members can create and update only their own tasks, while deletion is performed only by the allowlisted admin server action. The avatar migration creates a public-read `profile-avatars` bucket with a 5 MB limit and owner-only upload/delete policies; each replacement uses a unique object path and removes the prior uploaded object after the profile update succeeds. Community messages are readable by signed-in members and can only be inserted with the sender's own Clerk ID. Migration 006 adds persistent community-message replies and emoji reactions. Migration 010 adds private one-to-one conversations, read receipts, and per-user message hiding. Migration 011 adds DM replies and emoji reactions, with participant RLS and Realtime. Migration 012 stores each member's last-read community chat timestamp for unread badge counts. Migration 013 adds private `chat-photos` storage and attachment metadata to both chat tables. Chat supports JPG, PNG, WEBP, and GIF photos up to 4 MB, plus an in-app emoji picker. Photo upload, signed preview/download links, and cleanup use the server-only service key after the Clerk-authenticated user is checked against message RLS. Photos not downloaded within 3 days are expired and cleaned from storage by the hourly cron; a downloaded photo is retained. In private chat, a member can delete messages they sent for both participants, hide received messages from their own inbox, or hide all existing conversation messages from their inbox using the conversation menu; bulk hiding does not delete messages for the other participant. Admins listed in `ADMIN_USER_IDS` can delete individual messages sent by any member in the community Chat Room. Opening a chat conversation updates its read state. The `member_directory` view shares display name, username, avatar, and bio with authenticated members; email remains private to the profile owner.

For Vercel deployments, set `CRON_SECRET` to a long random server-side secret; [`vercel.json`](./vercel.json) schedules the protected cleanup endpoint hourly. The endpoint uses the `Authorization: Bearer <CRON_SECRET>` header and requires `SUPABASE_SERVICE_ROLE_KEY`. For other hosts, schedule an hourly HTTP GET to `/api/cron/expire-chat-photos` with that authorization header.

## 3. Run locally

```sh
npm install
npm run dev
```

Open `http://localhost:3000`, create an account, then use the Task List, Chat Room, Chat Pribadi, and Profile Saya navigation. Start a direct conversation from an authenticated member's profile popup. On the first authenticated portal request, the application inserts the Clerk user's profile; subsequent requests refresh the Clerk-managed name, email, and avatar while preserving the member's username and bio.

## Folder structure

```text
src/
├── app/
│   ├── (portal)/
│   │   ├── layout.tsx          # Authenticated shell and Clerk profile sync
│   │   ├── tasks/page.tsx      # Personal task list
│   │   ├── chat/page.tsx       # Community chat history and member count
│   │   ├── messages/page.tsx   # Private message inbox and unread/read filters
│   │   ├── messages/[conversationId]/page.tsx # One-to-one private chat
│   │   ├── profile/page.tsx    # Profile data and personal task statistics
│   │   └── admin/page.tsx      # Admin view for all tasks
│   ├── actions.ts              # Authenticated task/profile server actions
│   ├── globals.css             # Dark blue theme
│   ├── layout.tsx              # Clerk provider and global metadata
│   ├── page.tsx                # Public landing / sign-in entry
│   ├── sign-in/[[...sign-in]]/page.tsx
│   └── sign-up/[[...sign-up]]/page.tsx
├── components/
│   ├── chat-room.tsx           # Supabase Realtime messaging
│   ├── chat-message-bubble.tsx # Glassmorphism bubbles, reactions, and reply action
│   ├── direct-message-inbox.tsx # Private inbox with unread/read filters
│   ├── direct-chat-room.tsx    # Realtime one-to-one chat with read receipts
│   ├── portal-shell.tsx        # Responsive sidebar, navigation, and logout
│   ├── profile-editor.tsx      # Profile editor and task summary
│   ├── task-manager.tsx        # Member task management
│   └── admin-task-manager.tsx  # Admin task management and deletion
├── lib/
│   ├── portal-types.ts         # Shared portal data types
│   ├── supabase.ts             # Clerk and server-only admin clients
│   └── supabase-browser.ts     # Browser client for chat Realtime
└── middleware.ts               # Protects /tasks, /chat, /profile

supabase/migrations/
├── 002_artem_geng_portal.sql   # Portal DDL, RLS, indexes, and Realtime setup
└── 003_project_tasks_admin.sql # Project fields and admin-only deletion
```

## Environment variables

```dotenv
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your-supabase-publishable-key
ADMIN_USER_IDS=user_...
SUPABASE_SERVICE_ROLE_KEY=your-server-only-service-role-key
CRON_SECRET=a-long-random-server-only-secret
```

The AI chat route in the starter kit is separate from the Artem Geng community chat and can still require its own provider API key.

## Troubleshooting Clerk token validation

If the portal reports `No suitable key or wrong key type`, Supabase is not accepting the Clerk session JWT. Check that:

- The Clerk Supabase integration is activated for the same Clerk instance as the local publishable key.
- Supabase's Third-Party Auth provider is set to **Clerk** and uses the matching Clerk domain (not the Supabase URL or Clerk publishable key).
- The Clerk session token includes `role: "authenticated"` and has a `sub` claim.
- The browser/server was restarted after changing `.env.local`, then sign out and sign back in to get a fresh session.

Do not fix token validation by disabling RLS. The service-role key is only for the allowlisted admin server actions and must remain server-side.
