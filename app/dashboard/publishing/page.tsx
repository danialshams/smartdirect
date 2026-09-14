import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import PublishingWithTags from "../../../components/dashboard/publishing/PublishingWithTags";

export const dynamic = "force-dynamic";

export default async function PublishingPage() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    redirect("/login");
  }

  return <PublishingWithTags />;
}
