import { memo, useEffect, type ReactNode } from "react";
import { useLocation } from "react-router-dom";

import Footer from "@/components/layout/Footer";
import Header from "@/components/layout/Header";

type LayoutProps = { children: ReactNode };

const Layout = memo(({ children }: LayoutProps) => {
  const { pathname } = useLocation();

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "instant" });
  }, [pathname]);

  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="flex-1">{children}</main>
      <Footer />
    </div>
  );
});

Layout.displayName = "Layout";

export default Layout;
