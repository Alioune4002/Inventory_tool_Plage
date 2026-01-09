import React, { useEffect } from "react";
import Pos from "../Pos.jsx";

export default function PosApp() {
  useEffect(() => {
    const manifestLink = document.querySelector('link[rel="manifest"]');
    if (!manifestLink) return undefined;
    const previousHref = manifestLink.getAttribute("href") || "/manifest.webmanifest";
    manifestLink.setAttribute("href", "/pos.webmanifest");
    return () => {
      manifestLink.setAttribute("href", previousHref);
    };
  }, []);

  return <Pos />;
}
