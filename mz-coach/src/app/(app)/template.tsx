// template.tsx wird bei jedem Seitenwechsel neu gemountet, dadurch läuft die Einblendung jedes Mal.
export default function Template({ children }: { children: React.ReactNode }) {
  return <div className="page-in">{children}</div>;
}
