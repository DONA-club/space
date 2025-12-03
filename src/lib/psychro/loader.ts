/* Simple script loader for psychro-chart2d */
let loadPromise: Promise<any> | null = null;

function appendScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[data-psychro="${src}"]`) as HTMLScriptElement | null;
    if (existing) {
      const onLoad = () => resolve();
      const onError = () => reject(new Error(`Failed to load ${src}`));
      existing.addEventListener("load", onLoad, { once: true });
      existing.addEventListener("error", onError, { once: true });
      if ((existing as any)._loaded) {
        resolve();
      }
      return;
    }
    const s = document.createElement("script");
    s.src = src;
    s.async = true;
    s.defer = true;
    s.dataset.psychro = src;
    s.addEventListener("load", () => {
      (s as any)._loaded = true;
      resolve();
    }, { once: true });
    s.addEventListener("error", () => reject(new Error(`Failed to load ${src}`)), { once: true });
    document.head.appendChild(s);
  });
}

export function isPsychroLoaded(): boolean {
  return typeof (window as any).PsychroChart2D !== "undefined";
}

export function loadPsychroLib(): Promise<any> {
  if (typeof window === "undefined") {
    return Promise.resolve(null);
  }
  if (isPsychroLoaded()) {
    return Promise.resolve((window as any).PsychroChart2D);
  }
  if (loadPromise) return loadPromise;

  loadPromise = (async () => {
    // Load in order: core -> opts -> main
    await appendScript("/psychro/psychro-chart2d-core.min.js");
    await appendScript("/psychro/psychro-chart2d-opts.min.js");
    await appendScript("/psychro/psychro-chart2d.min.js");
    return (window as any).PsychroChart2D ?? null;
  })();

  return loadPromise;
}