// Einfache Darstellung der Antwort: Absätze, Aufzählungen und **fett**. Kein HTML aus der Antwort.
function Inline({ text }: { text: string }) {
  const teile = text.split(/(\*\*[^*]+\*\*)/g);
  return (
    <>
      {teile.map((t, i) => (t.startsWith("**") && t.endsWith("**") ? <strong key={i}>{t.slice(2, -2)}</strong> : <span key={i}>{t}</span>))}
    </>
  );
}

export function Antwort({ text }: { text: string }) {
  const bloecke = text.split(/\n{2,}/);
  return (
    <div className="space-y-3 text-[15px] leading-relaxed">
      {bloecke.map((b, i) => {
        const zeilen = b.split("\n");
        if (zeilen.every((z) => /^\s*([-*•]|\d+\.)\s+/.test(z))) {
          return (
            <ul key={i} className="list-disc space-y-1 pl-5">
              {zeilen.map((z, j) => (
                <li key={j}>
                  <Inline text={z.replace(/^\s*([-*•]|\d+\.)\s+/, "")} />
                </li>
              ))}
            </ul>
          );
        }
        if (/^#{1,4}\s/.test(b)) return <h3 key={i} className="display text-[17px] font-semibold"><Inline text={b.replace(/^#{1,4}\s/, "")} /></h3>;
        return (
          <p key={i} className="whitespace-pre-line">
            <Inline text={b} />
          </p>
        );
      })}
    </div>
  );
}
