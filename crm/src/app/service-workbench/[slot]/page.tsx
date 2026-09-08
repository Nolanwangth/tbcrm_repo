import { redirect } from "next/navigation";
export default async function LegacyServiceWorkbenchPage({ params }: {
    params: Promise<{
        slot: string;
    }>;
}) {
    const { slot } = await params;
    redirect(`/planner/${slot}`);
}
