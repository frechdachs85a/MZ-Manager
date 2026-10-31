// Service Worker nur für Push-Nachrichten (Marcus, 31.10.2026: Auktionsbericht aufs Handy). Er speichert nichts
// zwischen und fängt keine Seitenaufrufe ab.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));

self.addEventListener("push", (e) => {
  let d = {};
  try {
    d = e.data ? e.data.json() : {};
  } catch {
    d = { titel: "MZ Coach", text: e.data ? e.data.text() : "" };
  }
  e.waitUntil(
    self.registration.showNotification(d.titel || "MZ Coach", {
      body: d.text || "",
      icon: "/icons/icon-192.png",
      badge: "/icons/icon-192.png",
      tag: d.id ? `nachricht-${d.id}` : undefined,
      data: { link: d.link || "/" },
    }),
  );
});

self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  const ziel = (e.notification.data && e.notification.data.link) || "/";
  e.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((fenster) => {
      for (const f of fenster) {
        if ("focus" in f) {
          f.navigate(ziel);
          return f.focus();
        }
      }
      return self.clients.openWindow(ziel);
    }),
  );
});
