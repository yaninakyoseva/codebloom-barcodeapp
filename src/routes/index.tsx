import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import JsBarcode from "jsbarcode";
import { BrowserMultiFormatReader } from "@zxing/browser";
import { BarcodeFormat, DecodeHintType } from "@zxing/library";
import { Barcode, ScanLine, Download, Eraser, Upload, Copy, Check, AlertCircle, Flower2 } from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "CodeBloom — Barcode Generator & Reader" },
      { name: "description", content: "Generate Code 128 barcodes from text and decode barcode images right in your browser." },
      { property: "og:title", content: "CodeBloom — Barcode Generator & Reader" },
      { property: "og:description", content: "Generate and read Code 128 barcodes instantly, no sign-up needed." },
    ],
  }),
  component: Index,
});

const btn = "inline-flex items-center justify-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold transition-all disabled:opacity-50 disabled:pointer-events-none";
const btnPrimary = `${btn} bg-bloom text-primary-foreground shadow-soft hover:brightness-105 hover:-translate-y-0.5`;
const btnSoft = `${btn} bg-secondary text-secondary-foreground hover:bg-accent`;

function Index() {
  const [tab, setTab] = useState<"gen" | "read">("gen");
  return (
    <main className="min-h-screen bg-page px-4 py-10 sm:py-16">
      <div className="mx-auto max-w-2xl">
        <header className="text-center mb-8">
          <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-bloom text-primary-foreground shadow-soft">
            <Flower2 className="h-7 w-7" />
          </div>
          <h1 className="font-display text-4xl sm:text-5xl text-foreground">CodeBloom</h1>
          <p className="mt-2 text-muted-foreground">Create and read Code 128 barcodes — right in your browser.</p>
        </header>

        <div className="mx-auto mb-6 flex w-fit rounded-full bg-card p-1.5 shadow-soft">
          {([["gen", "Generate Barcode", Barcode], ["read", "Read Barcode", ScanLine]] as const).map(([k, label, Icon]) => (
            <button key={k} onClick={() => setTab(k)}
              className={`${btn} ${tab === k ? "bg-bloom text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}>
              <Icon className="h-4 w-4" /> <span>{label}</span>
            </button>
          ))}
        </div>

        <section key={tab} className="rounded-3xl bg-card p-6 sm:p-8 shadow-soft border border-border animate-in fade-in slide-in-from-bottom-2 duration-300">
          {tab === "gen" ? <Generator /> : <Reader />}
        </section>

        <section className="mt-8 rounded-3xl bg-card/60 p-6 text-sm text-muted-foreground border border-border">
          <h2 className="font-display text-lg text-foreground mb-2">How to use</h2>
          <ol className="list-decimal pl-5 space-y-1">
            <li><b>Generate:</b> type any text (standard ASCII). Your barcode appears instantly — click <i>Download PNG</i> to save it.</li>
            <li><b>Read:</b> upload a PNG or JPG with a Code 128 barcode. The decoded text shows up below — click <i>Copy</i> to use it.</li>
            <li>Everything runs locally; nothing is uploaded anywhere.</li>
          </ol>
        </section>
      </div>
    </main>
  );
}

function Generator() {
  const [text, setText] = useState("");
  const canvas = useRef<HTMLCanvasElement>(null);
  const invalid = /[^\x20-\x7E]/.test(text);
  const tooLong = text.length > 80;
  const ok = text.length > 0 && !invalid && !tooLong;

  useEffect(() => {
    if (ok && canvas.current) {
      JsBarcode(canvas.current, text, { format: "CODE128", displayValue: true, font: "Nunito", fontSize: 18, margin: 20, height: 100, lineColor: "#3a2340", background: "#ffffff" });
    }
  }, [text, ok]);

  const download = () => {
    if (!canvas.current) return;
    const a = document.createElement("a");
    a.href = canvas.current.toDataURL("image/png");
    a.download = `codebloom-${text.replace(/[^a-z0-9]+/gi, "-").slice(0, 30) || "barcode"}.png`;
    a.click();
  };

  return (
    <div className="space-y-5">
      <label className="block">
        <span className="text-sm font-semibold text-foreground">Text to encode</span>
        <input value={text} onChange={(e) => setText(e.target.value)} placeholder="e.g. HELLO-2026"
          className="mt-2 w-full rounded-2xl border border-input bg-muted px-4 py-3 text-foreground outline-none transition focus:ring-2 focus:ring-ring" />
        <span className={`mt-1.5 block text-xs ${invalid || tooLong ? "text-destructive" : "text-muted-foreground"}`}>
          {invalid ? "Only standard ASCII characters (letters, numbers, symbols) are supported." : tooLong ? "Please keep it under 80 characters." : `${text.length}/80 characters`}
        </span>
      </label>

      <div className="grid min-h-48 place-items-center rounded-2xl border-2 border-dashed border-border bg-muted/50 p-4">
        {ok ? (
          <div className="text-center w-full">
            <canvas ref={canvas} className="mx-auto max-w-full h-auto rounded-xl" />
            <p className="mt-3 break-all font-semibold text-foreground">{text}</p>
          </div>
        ) : (
          <p className="text-muted-foreground text-sm flex items-center gap-2"><Barcode className="h-5 w-5" /> Your barcode will bloom here</p>
        )}
      </div>

      <div className="flex flex-wrap gap-3 justify-end">
        <button className={btnSoft} onClick={() => setText("")} disabled={!text}><Eraser className="h-4 w-4" /> Clear</button>
        <button className={btnPrimary} onClick={download} disabled={!ok}><Download className="h-4 w-4" /> Download PNG</button>
      </div>
    </div>
  );
}

function Reader() {
  const [preview, setPreview] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  const handle = async (file?: File) => {
    if (!file) return;
    setResult(null); setError(null); setCopied(false);
    if (!/^image\/(png|jpe?g)$/.test(file.type)) { setError("Please upload a PNG, JPG, or JPEG image."); return; }
    const url = URL.createObjectURL(file);
    setPreview(url); setBusy(true);
    try {
      const hints = new Map();
      hints.set(DecodeHintType.POSSIBLE_FORMATS, [BarcodeFormat.CODE_128]);
      hints.set(DecodeHintType.TRY_HARDER, true);
      const reader = new BrowserMultiFormatReader(hints);
      const res = await reader.decodeFromImageUrl(url);
      setResult(res.getText());
    } catch {
      setError("We couldn't find a readable Code 128 barcode in this image. Try a clearer, well-lit, uncropped photo.");
    } finally { setBusy(false); }
  };

  const copy = async () => {
    if (!result) return;
    await navigator.clipboard.writeText(result);
    setCopied(true); setTimeout(() => setCopied(false), 1800);
  };

  return (
    <div className="space-y-5">
      <button onClick={() => input.current?.click()}
        onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); handle(e.dataTransfer.files[0]); }}
        className="grid w-full min-h-48 place-items-center rounded-2xl border-2 border-dashed border-border bg-muted/50 p-4 transition hover:border-ring hover:bg-muted">
        {preview ? <img src={preview} alt="Uploaded barcode" className="max-h-56 max-w-full rounded-xl" /> : (
          <span className="text-center text-muted-foreground">
            <Upload className="mx-auto mb-2 h-7 w-7 text-primary" />
            <span className="block font-semibold text-foreground">Click or drop an image</span>
            <span className="text-xs">PNG, JPG or JPEG</span>
          </span>
        )}
      </button>
      <input ref={input} type="file" accept="image/png,image/jpeg" className="hidden" onChange={(e) => { handle(e.target.files?.[0]); e.target.value = ""; }} />

      {busy && <p className="text-sm text-muted-foreground text-center">Reading barcode…</p>}
      {error && (
        <div className="flex gap-2 rounded-2xl bg-destructive/10 p-4 text-sm text-destructive animate-in fade-in">
          <AlertCircle className="h-5 w-5 shrink-0" /> {error}
        </div>
      )}
      {result !== null && (
        <div className="rounded-2xl bg-secondary p-5 animate-in fade-in slide-in-from-bottom-1">
          <p className="text-xs font-semibold uppercase tracking-wide text-secondary-foreground/70">Decoded text</p>
          <p className="mt-1 break-all text-xl font-semibold text-secondary-foreground">{result}</p>
          <div className="mt-4 flex justify-end">
            <button className={btnPrimary} onClick={copy}>{copied ? <><Check className="h-4 w-4" /> Copied!</> : <><Copy className="h-4 w-4" /> Copy</>}</button>
          </div>
        </div>
      )}
    </div>
  );
}
