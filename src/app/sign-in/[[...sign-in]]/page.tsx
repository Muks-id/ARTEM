import { SignIn } from "@clerk/nextjs";

export default function SignInPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#080e1c] px-4 py-12">
      <SignIn
        routing="path"
        path="/sign-in"
        signUpUrl="/sign-up"
        forceRedirectUrl="/tasks"
        appearance={{
          elements: {
            card: "border border-white/10 bg-[#0c1526] shadow-2xl",
            headerTitle: "text-slate-100",
            headerSubtitle: "text-slate-400",
          },
        }}
      />
    </main>
  );
}
