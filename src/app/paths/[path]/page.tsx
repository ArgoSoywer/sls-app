import { notFound } from "next/navigation";
import { DungeonPage } from "@/components/dungeons/dungeon-page";
import { isPathKey } from "@/features/game-engine";

export default async function PathPage({
  params,
}: {
  params: Promise<{ path: string }>;
}) {
  const { path } = await params;
  if (!isPathKey(path)) notFound();
  return <DungeonPage path={path} />;
}
