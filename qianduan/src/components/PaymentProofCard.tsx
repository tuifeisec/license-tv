import { ExternalLink, FileImage, Link2, ZoomIn } from "lucide-react";
import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";

const apiBaseURL = import.meta.env.VITE_API_BASE_URL ?? "";
const legacyProofBasePath = "/uploads/payment-proofs/";

function looksLikePaymentProofImage(value: string) {
  return /\.(png|jpg|jpeg|webp)(?:$|\?)/i.test(value) || value.includes(legacyProofBasePath);
}

function resolveProofUrl(value: string) {
  const normalized = value.trim();
  if (!normalized) {
    return "";
  }

  if (/^https?:\/\//i.test(normalized)) {
    return normalized;
  }

  if (normalized.includes(legacyProofBasePath)) {
    return `${apiBaseURL}${normalized.slice(normalized.indexOf(legacyProofBasePath))}`;
  }

  if (normalized.startsWith("/")) {
    return `${apiBaseURL}${normalized}`;
  }

  if (looksLikePaymentProofImage(normalized)) {
    return `${apiBaseURL}${legacyProofBasePath}${normalized.replace(/^\.?\/*/, "")}`;
  }

  return normalized;
}

function getDisplayName(url: string) {
  try {
    const parsed = new URL(url);
    const segment = parsed.pathname.split("/").filter(Boolean).pop();
    return segment || parsed.host;
  } catch {
    const segment = url.split("/").filter(Boolean).pop();
    return segment || "payment-proof";
  }
}

export function PaymentProofCard({
  url,
  emptyText = "未上传付款凭证",
}: {
  url?: string | null;
  emptyText?: string;
}) {
  const [imageFailed, setImageFailed] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);

  const resolvedUrl = useMemo(() => (url ? resolveProofUrl(url) : ""), [url]);
  const canOpenPreview = looksLikePaymentProofImage(resolvedUrl);
  const previewable = canOpenPreview && !imageFailed;
  const displayName = getDisplayName(resolvedUrl || url || "");

  if (!url) {
    return (
      <div className="rounded-xl border border-dashed border-border/70 bg-background/30 px-4 py-5 text-sm text-muted-foreground">
        {emptyText}
      </div>
    );
  }

  return (
    <>
      <div className="rounded-xl border border-border/70 bg-background/35">
        {previewable ? (
          <div className="border-b border-border/70 bg-background/60 p-2">
            <button
              type="button"
              onClick={() => setPreviewOpen(true)}
              className="group relative block w-full cursor-zoom-in overflow-hidden rounded-lg border border-border/60 bg-black/20"
            >
              <img
                src={resolvedUrl}
                alt="付款凭证"
                className="max-h-[320px] w-full object-contain"
                onError={() => setImageFailed(true)}
              />

              <div className="pointer-events-none absolute left-1/2 top-3 z-20 hidden w-[min(560px,78vw)] -translate-x-1/2 rounded-xl border border-border/80 bg-background/96 p-3 opacity-0 shadow-2xl transition-all duration-200 group-hover:opacity-100 group-focus-visible:opacity-100 md:block">
                <div className="mb-2 flex items-center justify-between gap-3 text-xs text-muted-foreground">
                  <span>悬浮预览</span>
                  <span>点击可固定放大</span>
                </div>
                <div className="overflow-hidden rounded-lg border border-border/70 bg-black/30">
                  <img src={resolvedUrl} alt="付款凭证悬浮预览" className="max-h-[520px] w-full object-contain" />
                </div>
              </div>

              <div className="pointer-events-none absolute inset-x-0 bottom-0 flex items-center justify-end bg-gradient-to-t from-background/80 to-transparent p-2 opacity-0 transition-opacity duration-200 group-hover:opacity-100">
                <span className="inline-flex items-center gap-1 rounded-md border border-border/70 bg-background/80 px-2 py-1 text-xs text-foreground">
                  <ZoomIn className="size-3.5" />
                  悬浮放大 / 点击查看
                </span>
              </div>
            </button>
          </div>
        ) : null}

        <div className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0 space-y-1">
            <div className="flex items-center gap-2 text-xs uppercase tracking-[0.16em] text-muted-foreground">
              {canOpenPreview ? <FileImage className="size-3.5" /> : <Link2 className="size-3.5" />}
              付款凭证
            </div>
            <div className="truncate text-sm font-medium">{displayName}</div>
            <div className="truncate text-xs text-muted-foreground">{resolvedUrl}</div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {canOpenPreview ? (
              <Button variant="ghost" size="sm" onClick={() => setPreviewOpen(true)}>
                <ZoomIn className="size-4" />
                打开原图
              </Button>
            ) : (
              <a
                href={resolvedUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex h-9 items-center justify-center gap-2 rounded-md border border-border bg-card/70 px-3 text-sm font-medium text-foreground transition-all duration-200 hover:bg-accent/70"
              >
                打开原图
                <ExternalLink className="size-4" />
              </a>
            )}
          </div>
        </div>
      </div>

      <Dialog
        open={previewOpen}
        onClose={() => setPreviewOpen(false)}
        title="付款凭证预览"
        description={displayName}
        footer={
          <>
            <Button variant="ghost" onClick={() => setPreviewOpen(false)}>
              关闭
            </Button>
            <a
              href={resolvedUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-border bg-card/70 px-4 text-sm font-medium text-foreground transition-all duration-200 hover:bg-accent/70"
            >
              新窗口打开
              <ExternalLink className="size-4" />
            </a>
          </>
        }
      >
        {previewable ? (
          <img src={resolvedUrl} alt="付款凭证大图" className="max-h-[75vh] w-full rounded-lg border border-border/60 bg-black/20 object-contain" />
        ) : (
          <div className="rounded-lg border border-dashed border-border/70 bg-background/35 px-4 py-6 text-sm text-muted-foreground">
            当前凭证无法在系统内预览，请使用“打开原图”查看。
          </div>
        )}
      </Dialog>
    </>
  );
}
