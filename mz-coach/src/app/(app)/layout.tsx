// Rahmen aller App-Seiten: Spielleiste oben, Inhalt, Navigation.

import { connection } from "next/server";
import { Navigation } from "@/components/navigation";
import { NachrichtenPopup } from "@/components/nachrichten-popup";
import { getDb } from "@/lib/db";
import { ungelesen } from "@/lib/nachricht";
import { Spielleiste } from "@/components/spielleiste";

// Gemeinsamer Rahmen der App-Seiten
export default async function AppLayout({ children }: LayoutProps<"/">) {
  await connection();
  const nachrichten = ungelesen(getDb());
  return (
    <>
      <main className="pb-tabbar lg:pb-12 lg:pl-60">
        <Spielleiste />
        {children}
      </main>
      <Navigation />
      <NachrichtenPopup key={nachrichten.map((n) => n.id).join(",")} nachrichten={nachrichten} />
    </>
  );
}
