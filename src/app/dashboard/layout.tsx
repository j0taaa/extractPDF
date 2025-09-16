import { ReactNode } from "react";
import { redirect } from "next/navigation";
import { getCurrentUserId } from "@/lib/auth";

export default async function DashboardLayout({ children }: { children: ReactNode }) {
  const userId = await getCurrentUserId();
  if (!userId) {
    redirect("/login");
  }

  return <>{children}</>;
}
