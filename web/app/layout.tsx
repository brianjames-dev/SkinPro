import "./globals.css";

export const metadata = {
  title: "SkinPro Web (Local)",
  description: "Local web UI for SkinPro"
};

export default function RootLayout({
  children
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
