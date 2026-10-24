import { Navigation } from "@/components/navigation";

export default function AppLayout({ children }: LayoutProps<"/">) {
  return (
    <>
      <main className="pb-tabbar lg:pb-12 lg:pl-60">{children}</main>
      <Navigation />
    </>
  );
}
