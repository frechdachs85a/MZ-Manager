import { Navigation } from "@/components/navigation";
import { PullToRefresh } from "@/components/pull-to-refresh";

export default function AppLayout({ children }: LayoutProps<"/">) {
  return (
    <>
      <PullToRefresh>
        <main className="pb-tabbar lg:pb-12 lg:pl-60">{children}</main>
      </PullToRefresh>
      <Navigation />
    </>
  );
}
