import { Navigation } from "@/components/navigation";
import { Spielleiste } from "@/components/spielleiste";

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
