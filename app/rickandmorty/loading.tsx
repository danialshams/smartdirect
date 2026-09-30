import { Card, Skeleton } from "antd";

export default function Loading() {
  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <Skeleton.Input active size="small" />
        <Skeleton.Input active style={{ width: 220 }} />
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => <Card key={i}><Skeleton active paragraph={{ rows: 2 }} /></Card>)}
      </div>
      <Card><Skeleton active paragraph={{ rows: 6 }} /></Card>
    </div>
  );
}
