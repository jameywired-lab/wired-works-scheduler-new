import { useRef, useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Loader2, Pen, Type, ArrowRight, Undo2, Trash2, Save, X, Minus, Plus } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";

type Tool = "pen" | "text" | "arrow";

interface Stroke {
  type: "pen";
  points: { x: number; y: number }[];
  color: string;
  width: number;
}

interface TextAnnotation {
  type: "text";
  x: number;
  y: number;
  text: string;
  color: string;
  fontSize: number;
}

interface ArrowAnnotation {
  type: "arrow";
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  color: string;
  width: number;
}

type Annotation = Stroke | TextAnnotation | ArrowAnnotation;

const COLORS = ["#ef4444", "#f97316", "#eab308", "#22c55e", "#3b82f6", "#a855f7", "#ffffff", "#000000"];

interface Props {
  photo: { id: number; s3Url: string; annotatedS3Url?: string | null; filename?: string | null };
  jobId: number;
  onClose: () => void;
  onSaved: (annotatedUrl: string) => void;
}

export default function PhotoAnnotationEditor({ photo, jobId, onClose, onSaved }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const [tool, setTool] = useState<Tool>("pen");
  const [color, setColor] = useState("#ef4444");
  const [strokeWidth, setStrokeWidth] = useState(3);
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [isDrawing, setIsDrawing] = useState(false);
  const [currentStroke, setCurrentStroke] = useState<{ x: number; y: number }[]>([]);
  const [arrowStart, setArrowStart] = useState<{ x: number; y: number } | null>(null);
  const [imgLoaded, setImgLoaded] = useState(false);
  const [pendingText, setPendingText] = useState<{ x: number; y: number } | null>(null);
  const [textInput, setTextInput] = useState("");
  const saveAnnotation = trpc.jobDocuments.saveAnnotation.useMutation();

  // Load the image into the canvas
  useEffect(() => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      imgRef.current = img;
      setImgLoaded(true);
    };
    img.onerror = () => toast.error("Failed to load image for annotation.");
    img.src = photo.annotatedS3Url ?? photo.s3Url;
  }, [photo.s3Url, photo.annotatedS3Url]);

  // Redraw canvas whenever annotations change
  useEffect(() => {
    if (!imgLoaded || !canvasRef.current || !imgRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d")!;
    const img = imgRef.current;

    // Set canvas size to image natural size (for high quality export)
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;

    ctx.drawImage(img, 0, 0);

    for (const ann of annotations) {
      if (ann.type === "pen") {
        if (ann.points.length < 2) continue;
        ctx.beginPath();
        ctx.strokeStyle = ann.color;
        ctx.lineWidth = ann.width;
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        ctx.moveTo(ann.points[0].x, ann.points[0].y);
        for (let i = 1; i < ann.points.length; i++) ctx.lineTo(ann.points[i].x, ann.points[i].y);
        ctx.stroke();
      } else if (ann.type === "text") {
        ctx.font = `bold ${ann.fontSize}px sans-serif`;
        ctx.fillStyle = ann.color;
        ctx.strokeStyle = "rgba(0,0,0,0.6)";
        ctx.lineWidth = 3;
        ctx.strokeText(ann.text, ann.x, ann.y);
        ctx.fillText(ann.text, ann.x, ann.y);
      } else if (ann.type === "arrow") {
        drawArrow(ctx, ann.x1, ann.y1, ann.x2, ann.y2, ann.color, ann.width);
      }
    }
  }, [annotations, imgLoaded]);

  function drawArrow(
    ctx: CanvasRenderingContext2D,
    x1: number, y1: number, x2: number, y2: number,
    clr: string, w: number
  ) {
    const headLen = Math.max(16, w * 5);
    const angle = Math.atan2(y2 - y1, x2 - x1);
    ctx.beginPath();
    ctx.strokeStyle = clr;
    ctx.fillStyle = clr;
    ctx.lineWidth = w;
    ctx.lineCap = "round";
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x2, y2);
    ctx.lineTo(x2 - headLen * Math.cos(angle - Math.PI / 6), y2 - headLen * Math.sin(angle - Math.PI / 6));
    ctx.lineTo(x2 - headLen * Math.cos(angle + Math.PI / 6), y2 - headLen * Math.sin(angle + Math.PI / 6));
    ctx.closePath();
    ctx.fill();
  }

  function getCanvasCoords(e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    let clientX: number, clientY: number;
    if ("touches" in e) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = e.clientX;
      clientY = e.clientY;
    }
    return {
      x: (clientX - rect.left) * scaleX,
      y: (clientY - rect.top) * scaleY,
    };
  }

  const handlePointerDown = useCallback((e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const { x, y } = getCanvasCoords(e);
    if (tool === "pen") {
      setIsDrawing(true);
      setCurrentStroke([{ x, y }]);
    } else if (tool === "arrow") {
      setArrowStart({ x, y });
      setIsDrawing(true);
    } else if (tool === "text") {
      setPendingText({ x, y });
      setTextInput("");
    }
  }, [tool]);

  const handlePointerMove = useCallback((e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    e.preventDefault();
    const { x, y } = getCanvasCoords(e);
    if (tool === "pen") {
      setCurrentStroke(prev => [...prev, { x, y }]);
      // Live draw on canvas
      const canvas = canvasRef.current!;
      const ctx = canvas.getContext("2d")!;
      const pts = [...currentStroke, { x, y }];
      if (pts.length >= 2) {
        ctx.beginPath();
        ctx.strokeStyle = color;
        ctx.lineWidth = strokeWidth;
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        ctx.moveTo(pts[pts.length - 2].x, pts[pts.length - 2].y);
        ctx.lineTo(pts[pts.length - 1].x, pts[pts.length - 1].y);
        ctx.stroke();
      }
    }
  }, [isDrawing, tool, color, strokeWidth, currentStroke]);

  const handlePointerUp = useCallback((e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    const { x, y } = getCanvasCoords(e);
    if (tool === "pen" && currentStroke.length > 1) {
      setAnnotations(prev => [...prev, { type: "pen", points: [...currentStroke, { x, y }], color, width: strokeWidth }]);
    } else if (tool === "arrow" && arrowStart) {
      setAnnotations(prev => [...prev, { type: "arrow", x1: arrowStart.x, y1: arrowStart.y, x2: x, y2: y, color, width: strokeWidth }]);
      setArrowStart(null);
    }
    setIsDrawing(false);
    setCurrentStroke([]);
  }, [isDrawing, tool, currentStroke, color, strokeWidth, arrowStart]);

  const handleAddText = () => {
    if (!pendingText || !textInput.trim()) { setPendingText(null); return; }
    setAnnotations(prev => [...prev, {
      type: "text",
      x: pendingText.x,
      y: pendingText.y,
      text: textInput.trim(),
      color,
      fontSize: Math.max(24, strokeWidth * 8),
    }]);
    setPendingText(null);
    setTextInput("");
  };

  const handleUndo = () => setAnnotations(prev => prev.slice(0, -1));
  const handleClear = () => setAnnotations([]);

  const handleSave = async () => {
    if (!canvasRef.current) return;
    const base64 = canvasRef.current.toDataURL("image/png");
    try {
      const result = await saveAnnotation.mutateAsync({ photoId: photo.id, jobId, base64 });
      toast.success("Annotated photo saved.");
      onSaved(result.url);
    } catch {
      toast.error("Failed to save annotation.");
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/90 flex flex-col">
      {/* Toolbar */}
      <div className="flex items-center gap-2 px-4 py-3 bg-zinc-900 border-b border-zinc-700 flex-wrap">
        <span className="text-sm font-semibold text-white mr-2">Annotate Photo</span>

        {/* Tool buttons */}
        <div className="flex gap-1">
          {([["pen", <Pen className="h-4 w-4" />, "Pen"], ["text", <Type className="h-4 w-4" />, "Text"], ["arrow", <ArrowRight className="h-4 w-4" />, "Arrow"]] as [Tool, React.ReactNode, string][]).map(([t, icon, label]) => (
            <button
              key={t}
              onClick={() => setTool(t)}
              title={label}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded text-xs font-medium transition-colors ${tool === t ? "bg-primary text-primary-foreground" : "bg-zinc-800 text-zinc-300 hover:bg-zinc-700"}`}
            >
              {icon} {label}
            </button>
          ))}
        </div>

        {/* Color picker */}
        <div className="flex gap-1 ml-2">
          {COLORS.map(c => (
            <button
              key={c}
              onClick={() => setColor(c)}
              style={{ backgroundColor: c }}
              className={`w-6 h-6 rounded-full border-2 transition-transform ${color === c ? "border-white scale-110" : "border-zinc-600"}`}
            />
          ))}
        </div>

        {/* Stroke width */}
        <div className="flex items-center gap-1 ml-2">
          <button onClick={() => setStrokeWidth(w => Math.max(1, w - 1))} className="p-1 rounded bg-zinc-800 text-zinc-300 hover:bg-zinc-700">
            <Minus className="h-3 w-3" />
          </button>
          <span className="text-xs text-zinc-300 w-4 text-center">{strokeWidth}</span>
          <button onClick={() => setStrokeWidth(w => Math.min(20, w + 1))} className="p-1 rounded bg-zinc-800 text-zinc-300 hover:bg-zinc-700">
            <Plus className="h-3 w-3" />
          </button>
        </div>

        <div className="flex gap-1 ml-auto">
          <Button size="sm" variant="ghost" onClick={handleUndo} disabled={annotations.length === 0} className="text-zinc-300 hover:text-white">
            <Undo2 className="h-4 w-4" />
          </Button>
          <Button size="sm" variant="ghost" onClick={handleClear} disabled={annotations.length === 0} className="text-zinc-300 hover:text-white">
            <Trash2 className="h-4 w-4" />
          </Button>
          <Button size="sm" onClick={handleSave} disabled={saveAnnotation.isPending || annotations.length === 0} className="bg-emerald-600 hover:bg-emerald-700 text-white">
            {saveAnnotation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4 mr-1" />}
            Save
          </Button>
          <Button size="sm" variant="ghost" onClick={onClose} className="text-zinc-300 hover:text-white">
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Canvas area */}
      <div className="flex-1 overflow-auto flex items-center justify-center p-4 relative">
        {!imgLoaded && (
          <div className="flex items-center gap-2 text-zinc-400">
            <Loader2 className="h-5 w-5 animate-spin" /> Loading image…
          </div>
        )}
        {imgLoaded && (
          <canvas
            ref={canvasRef}
            className="max-w-full max-h-full rounded-lg shadow-2xl"
            style={{ cursor: tool === "text" ? "text" : "crosshair", touchAction: "none" }}
            onMouseDown={handlePointerDown}
            onMouseMove={handlePointerMove}
            onMouseUp={handlePointerUp}
            onTouchStart={handlePointerDown}
            onTouchMove={handlePointerMove}
            onTouchEnd={handlePointerUp}
          />
        )}

        {/* Text input overlay */}
        {pendingText && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/50">
            <div className="bg-zinc-800 rounded-xl p-4 shadow-2xl w-80 space-y-3">
              <p className="text-sm font-medium text-white">Enter annotation text</p>
              <input
                autoFocus
                type="text"
                value={textInput}
                onChange={e => setTextInput(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter") handleAddText(); if (e.key === "Escape") setPendingText(null); }}
                placeholder="Type your note…"
                className="w-full h-9 px-3 text-sm rounded-md border border-zinc-600 bg-zinc-700 text-white placeholder:text-zinc-400 focus:outline-none focus:ring-1 focus:ring-primary"
              />
              <div className="flex gap-2">
                <Button size="sm" onClick={handleAddText} disabled={!textInput.trim()} className="flex-1">Add Text</Button>
                <Button size="sm" variant="ghost" onClick={() => setPendingText(null)} className="text-zinc-300">Cancel</Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
