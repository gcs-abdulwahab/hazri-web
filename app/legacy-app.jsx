"use client";

import { useEffect, useState } from "react";

const scripts = [
  "/legacy/supabase.js",
  "/legacy/xlsx.js",
  "/legacy/app.js",
];

let appLoad;

function loadApp() {
  if (!appLoad) {
    appLoad = scripts.reduce(
      (previous, src) =>
        previous.then(
          () =>
            new Promise((resolve, reject) => {
              const script = document.createElement("script");
              script.src = src;
              script.onload = resolve;
              script.onerror = () =>
                reject(new Error(`Could not load ${src}`));
              document.body.appendChild(script);
            }),
        ),
      Promise.resolve(),
    );
  }
  return appLoad;
}

export default function LegacyApp() {
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    loadApp().catch((error) => {
      console.error("Hazri Register failed to start.", error);
      setLoadError("The app could not start. Reload the page to try again.");
    });
  }, []);

  return (
    <>
      <div className="wrap" id="app" />
      <div className="toast" id="toast" role="status" hidden />
      {loadError && (
        <p role="alert" style={{ textAlign: "center", padding: "2rem" }}>
          {loadError}
        </p>
      )}
    </>
  );
}
