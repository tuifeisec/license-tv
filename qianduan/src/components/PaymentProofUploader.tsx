import { type ChangeEvent, type ClipboardEvent, type DragEvent, useRef, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { ImagePlus, LoaderCircle, MousePointerClick, Trash2, UploadCloud } from "lucide-react";

import { uploadAgentPaymentProof } from "@/api/agent/requests";
import { PaymentProofCard } from "@/components/PaymentProofCard";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { notify } from "@/store/ui-store";

const MAX_FILE_SIZE = 5 * 1024 * 1024;
const ACCEPTED_TYPES = ["image/png", "image/jpeg", "image/webp"];

function extractImageFile(fileList: FileList | null) {
  if (!fileList) {
    return null;
  }
  return Array.from(fileList).find((file) => ACCEPTED_TYPES.includes(file.type)) ?? null;
}

export function PaymentProofUploader({
  value,
  onChange,
  disabled,
}: {
  value?: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const uploadMutation = useMutation({
    mutationFn: uploadAgentPaymentProof,
    onSuccess: (data) => {
      onChange(data.path);
      notify({ title: "付款凭证已上传", tone: "success" });
    },
  });

  const openFileDialog = () => {
    if (!disabled && !uploadMutation.isPending) {
      inputRef.current?.click();
    }
  };

  const uploadFile = async (file: File | null) => {
    if (!file) {
      return;
    }

    if (!ACCEPTED_TYPES.includes(file.type)) {
      notify({ title: "文件格式不支持", description: "仅支持 PNG、JPG、WEBP 图片。", tone: "warning" });
      return;
    }

    if (file.size > MAX_FILE_SIZE) {
      notify({ title: "文件过大", description: "付款凭证需控制在 5MB 以内。", tone: "warning" });
      return;
    }

    await uploadMutation.mutateAsync(file);
  };

  const handleFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = extractImageFile(event.target.files);
    event.target.value = "";
    await uploadFile(file);
  };

  const handleDrop = async (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDragActive(false);
    if (disabled || uploadMutation.isPending) {
      return;
    }
    await uploadFile(extractImageFile(event.dataTransfer.files));
  };

  const handlePaste = async (event: ClipboardEvent<HTMLDivElement>) => {
    if (disabled || uploadMutation.isPending) {
      return;
    }
    const file = extractImageFile(event.clipboardData.files);
    if (!file) {
      return;
    }
    event.preventDefault();
    await uploadFile(file);
  };

  return (
    <div className="space-y-3">
      <div
        role="button"
        tabIndex={0}
        onClick={openFileDialog}
        onPaste={handlePaste}
        onDragEnter={(event) => {
          event.preventDefault();
          if (!disabled && !uploadMutation.isPending) {
            setDragActive(true);
          }
        }}
        onDragOver={(event) => event.preventDefault()}
        onDragLeave={(event) => {
          event.preventDefault();
          setDragActive(false);
        }}
        onDrop={handleDrop}
        className={cn(
          "rounded-xl border border-dashed px-4 py-4 transition-colors duration-200",
          dragActive ? "border-primary bg-primary/8" : "border-border/70 bg-background/35",
          disabled || uploadMutation.isPending ? "cursor-not-allowed opacity-80" : "cursor-pointer hover:bg-accent/40",
        )}
      >
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-start gap-3">
            <div className="rounded-xl border border-border/70 bg-background/70 p-3 text-primary">
              {uploadMutation.isPending ? <LoaderCircle className="size-5 animate-spin" /> : <UploadCloud className="size-5" />}
            </div>
            <div className="space-y-1">
              <div className="text-sm font-semibold">上传付款凭证</div>
              <div className="text-xs text-muted-foreground">
                支持拖拽上传、点击选择或直接粘贴截图。仅支持 PNG、JPG、WEBP，5MB 以内。
              </div>
              <div className="flex flex-wrap items-center gap-3 text-[11px] text-muted-foreground">
                <span className="inline-flex items-center gap-1">
                  <MousePointerClick className="size-3.5" />
                  点击选择
                </span>
                <span>拖拽图片到此处</span>
                <span>Ctrl+V 粘贴截图</span>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {value ? (
              <Button
                variant="ghost"
                size="sm"
                onClick={(event) => {
                  event.stopPropagation();
                  onChange("");
                }}
                disabled={disabled || uploadMutation.isPending}
              >
                <Trash2 className="size-4" />
                清除
              </Button>
            ) : null}
            <Button
              size="sm"
              onClick={(event) => {
                event.stopPropagation();
                openFileDialog();
              }}
              disabled={disabled || uploadMutation.isPending}
            >
              {uploadMutation.isPending ? <LoaderCircle className="size-4 animate-spin" /> : <ImagePlus className="size-4" />}
              {value ? "重新上传" : "选择图片"}
            </Button>
          </div>
        </div>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className="hidden"
        onChange={handleFileChange}
      />

      <PaymentProofCard url={value} emptyText="上传后会在这里预览，管理员审核时也会看到同一张凭证图片。" />
    </div>
  );
}
