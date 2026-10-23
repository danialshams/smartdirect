import DashboardRoute from "../../../../components/dashboard/DashboardRoute";
import ShareMentionEditor from "../../../../components/dashboard/ShareMentionEditor";
export default async function Page({params}:{params:Promise<{id:string}>}){const {id}=await params;return <DashboardRoute><ShareMentionEditor id={id}/></DashboardRoute>;}
