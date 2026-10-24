import { PullToRefresh } from "@/components/pull-to-refresh";
import { TabBar } from "@/components/tab-bar";

export default function AppLayout({ children }: LayoutProps<"/">) {
  return (
    <>
      <PullToRefresh>
        <main className="pb-tabbar">{children}</main>
      </PullToRefresh>
      <TabBar />
    </>
  );
}
