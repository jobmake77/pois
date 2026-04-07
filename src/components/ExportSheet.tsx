import type { ExportPreview } from "../types";

interface ExportSheetProps {
  preview: ExportPreview | null;
  format: "png" | "jpeg";
  onClose: () => void;
  onDownload: () => void;
  onShare: () => void;
  onCopy: () => void;
}

export function ExportSheet({
  preview,
  format,
  onClose,
  onDownload,
  onShare,
  onCopy
}: ExportSheetProps) {
  if (!preview) {
    return null;
  }

  return (
    <div className="export-sheet-backdrop" onClick={onClose}>
      <div className="export-sheet" onClick={(event) => event.stopPropagation()}>
        <div className="sheet-head">
          <div>
            <p className="eyebrow">导出完成</p>
            <h2>高清海报已准备好</h2>
            <p>生成耗时 {preview.durationMs.toFixed(0)}ms</p>
          </div>
          <button className="icon-chip" onClick={onClose}>
            关闭
          </button>
        </div>

        <div className="sheet-preview">
          <img src={preview.url} alt="导出预览" />
        </div>

        <div className="sheet-actions">
          <button className="secondary-button" onClick={onCopy}>
            复制分享文案
          </button>
          <button className="secondary-button" onClick={onDownload}>
            下载 {format.toUpperCase()}
          </button>
          <button className="primary-button" onClick={onShare}>
            系统分享
          </button>
        </div>
      </div>
    </div>
  );
}
