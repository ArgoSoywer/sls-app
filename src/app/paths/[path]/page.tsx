import { notFound } from "next/navigation";
import { DungeonPage } from "@/components/dungeons/dungeon-page";
import { PATHS, type PathKey } from "@/types/game";

export default async function PathPage({
  params,
}: {
  params: Promise<{ path: string }>;
}) {
  const { path } = await params;
  if (!PATHS.includes(path as PathKey)) notFound();
  return <DungeonPage path={path as PathKey} />;
}
