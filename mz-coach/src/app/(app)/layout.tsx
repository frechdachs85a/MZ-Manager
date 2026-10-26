// Rahmen aller App-Seiten: Spielleiste oben, Inhalt, Navigation.

import { Navigation } from "@/components/navigation";
import { Spielleiste } from "@/components/spielleiste";

// Gemeinsamer Rahmen der App-Seiten
export default function AppLayout({ children }: LayoutProps<"/">) {
  return (
    <>
      <main className="pb-tabbar lg:pb-12 lg:pl-60">
        <Spielleiste />
        {children}
      </main>
      <Navigation />
    </>
  );
}
