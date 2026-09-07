import React from "react";
import "./style.css";
export const metadata = {
  title: "NearHire Admin",
  description: "NearHire operations and moderation",
};
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <header>
          <strong>
            nearhire<span>.</span>
          </strong>
          <small>OPERATIONS</small>
        </header>
        <main>{children}</main>
      </body>
    </html>
  );
}
