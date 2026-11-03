import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { SESSION_COOKIE, verifySessionCookie } from "@/lib/hc-auth";
import UnderConstruction from "@/app/components/UnderConstruction";

export default async function LoginPage() {
  const cookieStore = await cookies();
  const session = verifySessionCookie(cookieStore.get(SESSION_COOKIE)?.value);

  if (session) {
    redirect("/dashboard");
  }

  return <UnderConstruction />;
}
