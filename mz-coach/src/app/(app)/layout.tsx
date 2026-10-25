import { Navigation } from "@/components/navigation";

export default function AppLayout({ children }: LayoutProps<"/">) {
  return (
    <>
      <main className="pb-tabbar lg:pb-12 lg:pl-64">{children}</main>
      <Navigation />
    </>
  );
}
