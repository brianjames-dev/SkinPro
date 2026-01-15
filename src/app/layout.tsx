import "./globals.css";
import DisableAutocomplete from "./disable-autocomplete";

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
      <body>
        {children}
        <DisableAutocomplete />
      </body>
    </html>
  );
}
