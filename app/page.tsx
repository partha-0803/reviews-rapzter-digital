import AdminDesk from "@/components/AdminDesk";
import AdminLogin from "@/components/AdminLogin";
import { currentAdmin } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const email = await currentAdmin();
  if (!email) return <AdminLogin />;
  return <AdminDesk email={email} />;
}
