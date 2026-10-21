import DashboardRoute from "../../../../components/dashboard/DashboardRoute";
import DirectAutomationEditor from "../../../../components/dashboard/DirectAutomationEditor";
export default async function EditDirectAutomationPage({params}:{params:Promise<{id:string}>}){const {id}=await params;return <DashboardRoute><DirectAutomationEditor id={id}/></DashboardRoute>;}
