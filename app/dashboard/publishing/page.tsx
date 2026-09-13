import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import PublishingDashboard from "../../../components/dashboard/publishing/PublishingDashboard";
export const dynamic = "force-dynamic";

export default async function PublishingPage() {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
        redirect("/login");
    }

    return <PublishingDashboard />;
}