import { Box, Card, Skeleton } from "@mui/material";

export default function Loading() {
  return (
    <Box sx={{ display: "grid", gap: 2 }}>
      <Box>
        <Skeleton variant="text" width={140} height={36} />
        <Skeleton variant="text" width={260} height={24} />
      </Box>
      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "repeat(2, 1fr)", xl: "repeat(4, 1fr)" }, gap: 2 }}>
        {Array.from({ length: 4 }).map((_, i) => <Card key={i} sx={{ p: 2.5 }}><Skeleton variant="rounded" height={100} /></Card>)}
      </Box>
      <Card sx={{ p: 2.5 }}><Skeleton variant="rounded" height={240} /></Card>
    </Box>
  );
}
