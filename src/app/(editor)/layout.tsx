export const metadata = { title: "Template editor" };

// Deliberately no AppShell here — full-screen builder routes (the template editor) own the whole
// viewport themselves, like Unlayer/Stripo/Beefree's editors do, rather than sitting inside the
// app's normal sidebar/header/footer chrome. Auth is still enforced by src/proxy.ts middleware on
// the path itself, so moving out of (shell) doesn't bypass the session check.
export default function EditorLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
