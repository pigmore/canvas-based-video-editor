"use client";

import {
  ChangeEvent,
  PointerEvent as ReactPointerEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

const STAGE_WIDTH = 1280;
const STAGE_HEIGHT = 720;
const FPS = 30;
const INITIAL_DURATION = 15;

type AssetType = "image" | "video" | "text";
type Easing = "linear" | "easeIn" | "easeOut" | "easeInOut";
type Transform = {
  x: number;
  y: number;
  z: number;
  width: number;
  height: number;
  rotation: number;
  opacity: number;
};
type Keyframe = Transform & { id: string; time: number; easing: Easing };
type Layer = {
  id: string;
  name: string;
  type: AssetType;
  start: number;
  end: number;
  transform: Transform;
  keyframes: Keyframe[];
  source?: string;
  text?: string;
  color?: string;
  visible: boolean;
};

type ProjectFile = {
  format: "lumaframe";
  version: 1;
  name: string;
  width: number;
  height: number;
  fps: number;
  duration: number;
  createdAt: string;
  layers: Layer[];
};

const id = () => Math.random().toString(36).slice(2, 9);
const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

function downloadBlob(blob: Blob, filename: string) {
  const anchor = document.createElement("a");
  const url = URL.createObjectURL(blob);
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function blobToDataUrl(blob: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

const initialLayers: Layer[] = [
  {
    id: "title",
    name: "Make ideas move",
    type: "text",
    start: 0,
    end: 8,
    text: "MAKE IDEAS\nMOVE",
    color: "#F2F3F4",
    visible: true,
    transform: { x: 640, y: 354, z: 2, width: 720, height: 210, rotation: 0, opacity: 1 },
    keyframes: [
      { id: "title-k1", time: 0, easing: "easeOut", x: 540, y: 354, z: 2, width: 720, height: 210, rotation: -3, opacity: 0 },
      { id: "title-k2", time: 1.2, easing: "easeOut", x: 640, y: 354, z: 2, width: 720, height: 210, rotation: 0, opacity: 1 },
    ],
  },
  {
    id: "caption",
    name: "Canvas motion studio",
    type: "text",
    start: 0.6,
    end: 8,
    text: "CANVAS MOTION STUDIO  /  001",
    color: "#D6FF43",
    visible: true,
    transform: { x: 640, y: 515, z: 3, width: 480, height: 40, rotation: 0, opacity: 1 },
    keyframes: [
      { id: "caption-k1", time: 0.6, easing: "easeInOut", x: 640, y: 535, z: 3, width: 480, height: 40, rotation: 0, opacity: 0 },
      { id: "caption-k2", time: 1.7, easing: "easeOut", x: 640, y: 515, z: 3, width: 480, height: 40, rotation: 0, opacity: 1 },
    ],
  },
];

function easingValue(value: number, easing: Easing) {
  if (easing === "easeIn") return value * value;
  if (easing === "easeOut") return 1 - (1 - value) * (1 - value);
  if (easing === "easeInOut") {
    return value < 0.5
      ? 2 * value * value
      : 1 - Math.pow(-2 * value + 2, 2) / 2;
  }
  return value;
}

function transformAt(layer: Layer, time: number): Transform {
  const frames = [...layer.keyframes].sort((a, b) => a.time - b.time);
  if (!frames.length) return layer.transform;
  if (time <= frames[0].time) return frames[0];
  if (time >= frames[frames.length - 1].time) return frames[frames.length - 1];
  const nextIndex = frames.findIndex((frame) => frame.time >= time);
  const previous = frames[nextIndex - 1];
  const next = frames[nextIndex];
  const progress = easingValue(
    (time - previous.time) / (next.time - previous.time),
    next.easing,
  );
  return {
    x: previous.x + (next.x - previous.x) * progress,
    y: previous.y + (next.y - previous.y) * progress,
    z: previous.z + (next.z - previous.z) * progress,
    width: previous.width + (next.width - previous.width) * progress,
    height: previous.height + (next.height - previous.height) * progress,
    rotation: previous.rotation + (next.rotation - previous.rotation) * progress,
    opacity: previous.opacity + (next.opacity - previous.opacity) * progress,
  };
}

function formatTime(time: number, compact = false) {
  const safe = Math.max(0, time);
  const minutes = Math.floor(safe / 60);
  const seconds = Math.floor(safe % 60);
  const frames = Math.floor((safe % 1) * FPS);
  if (compact) {
    return `${seconds.toString().padStart(2, "0")}:${frames.toString().padStart(2, "0")}`;
  }
  return `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}:${frames.toString().padStart(2, "0")}`;
}

function layerColor(type: AssetType) {
  if (type === "video") return "#9c7cff";
  if (type === "image") return "#53a8ff";
  return "#d6ff43";
}

function renderComposition(
  ctx: CanvasRenderingContext2D,
  layers: Layer[],
  time: number,
  media: Map<string, HTMLImageElement | HTMLVideoElement>,
  options: {
    selectedId?: string;
    selectionScale?: number;
    showHud?: boolean;
  } = {},
) {
  const selectionScale = options.selectionScale ?? 1;
  ctx.clearRect(0, 0, STAGE_WIDTH, STAGE_HEIGHT);

  const background = ctx.createLinearGradient(0, 0, STAGE_WIDTH, STAGE_HEIGHT);
  background.addColorStop(0, "#17191f");
  background.addColorStop(0.48, "#090a0c");
  background.addColorStop(1, "#191b20");
  ctx.fillStyle = background;
  ctx.fillRect(0, 0, STAGE_WIDTH, STAGE_HEIGHT);

  const glow = ctx.createRadialGradient(640, 350, 20, 640, 350, 510);
  glow.addColorStop(0, "rgba(126, 111, 177, 0.18)");
  glow.addColorStop(1, "rgba(12, 13, 15, 0)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, STAGE_WIDTH, STAGE_HEIGHT);

  ctx.strokeStyle = "rgba(255,255,255,.032)";
  ctx.lineWidth = 1;
  for (let x = 40; x < STAGE_WIDTH; x += 40) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, STAGE_HEIGHT);
    ctx.stroke();
  }
  for (let y = 40; y < STAGE_HEIGHT; y += 40) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(STAGE_WIDTH, y);
    ctx.stroke();
  }

  const active = layers
    .filter((layer) => layer.visible && time >= layer.start && time <= layer.end)
    .sort((a, b) => transformAt(a, time).z - transformAt(b, time).z);

  active.forEach((layer) => {
    const transform = transformAt(layer, time);
    ctx.save();
    ctx.globalAlpha = clamp(transform.opacity, 0, 1);
    ctx.translate(transform.x, transform.y);
    ctx.rotate((transform.rotation * Math.PI) / 180);

    if (layer.type === "text") {
      const lines = (layer.text ?? "").split("\n");
      const fontSize = Math.max(
        10,
        Math.min(
          (transform.height / lines.length) * 0.78,
          transform.width / 7.8,
        ),
      );
      ctx.fillStyle = layer.color ?? "#fff";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.font = `800 ${fontSize}px Arial, Helvetica, sans-serif`;
      ctx.shadowColor = "rgba(0,0,0,.24)";
      ctx.shadowBlur = 16;
      lines.forEach((line, index) => {
        const lineY = (index - (lines.length - 1) / 2) * fontSize * 0.9;
        ctx.fillText(line, 0, lineY, transform.width);
      });
    } else {
      const item = media.get(layer.id);
      if (item) {
        try {
          if (item instanceof HTMLVideoElement) {
            const localTime = clamp(
              time - layer.start,
              0,
              Math.max(0, item.duration || 0),
            );
            if (
              Math.abs(item.currentTime - localTime) > 0.12 &&
              item.readyState >= 1
            ) {
              item.currentTime = localTime;
            }
          }
          const ready =
            item instanceof HTMLImageElement
              ? item.complete
              : item.readyState >= 2;
          if (ready) {
            ctx.drawImage(
              item,
              -transform.width / 2,
              -transform.height / 2,
              transform.width,
              transform.height,
            );
          } else {
            ctx.fillStyle = "#22262d";
            ctx.fillRect(
              -transform.width / 2,
              -transform.height / 2,
              transform.width,
              transform.height,
            );
          }
        } catch {
          // A video frame can be briefly unavailable during a seek.
        }
      }
    }

    if (options.selectedId === layer.id) {
      ctx.globalAlpha = 1;
      ctx.shadowBlur = 0;
      ctx.strokeStyle = "#d6ff43";
      ctx.lineWidth = 2 / selectionScale;
      ctx.setLineDash([7 / selectionScale, 5 / selectionScale]);
      ctx.strokeRect(
        -transform.width / 2,
        -transform.height / 2,
        transform.width,
        transform.height,
      );
      ctx.setLineDash([]);
      const handle = 8 / selectionScale;
      ctx.fillStyle = "#d6ff43";
      [
        [-transform.width / 2, -transform.height / 2],
        [transform.width / 2, -transform.height / 2],
        [-transform.width / 2, transform.height / 2],
        [transform.width / 2, transform.height / 2],
      ].forEach(([x, y]) =>
        ctx.fillRect(x - handle / 2, y - handle / 2, handle, handle),
      );
    }
    ctx.restore();
  });

  if (options.showHud) {
    ctx.fillStyle = "rgba(255,255,255,.28)";
    ctx.font = "500 11px Arial";
    ctx.textAlign = "left";
    ctx.fillText("LUMAFRAME / PREVIEW", 24, 32);
    ctx.textAlign = "right";
    ctx.fillText(formatTime(time), STAGE_WIDTH - 24, 32);
  }
}

export function VideoEditor() {
  const [layers, setLayers] = useState<Layer[]>(initialLayers);
  const [selectedId, setSelectedId] = useState("title");
  const [currentTime, setCurrentTime] = useState(1.2);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isDraggingStage, setIsDraggingStage] = useState(false);
  const [toast, setToast] = useState("");
  const [exportProgress, setExportProgress] = useState<number | null>(null);
  const [isSavingProject, setIsSavingProject] = useState(false);
  const [duration, setDuration] = useState(INITIAL_DURATION);
  const monitorRef = useRef<HTMLCanvasElement>(null);
  const timelineRef = useRef<HTMLCanvasElement>(null);
  const uploadRef = useRef<HTMLInputElement>(null);
  const projectRef = useRef<HTMLInputElement>(null);
  const mediaRef = useRef<Map<string, HTMLImageElement | HTMLVideoElement>>(new Map());
  const animationRef = useRef<number | null>(null);
  const exportAnimationRef = useRef<number | null>(null);
  const exportCancelRef = useRef(false);
  const exportRecorderRef = useRef<MediaRecorder | null>(null);
  const playbackRef = useRef({ wall: 0, time: 0 });
  const stageDragRef = useRef<{ id: string; offsetX: number; offsetY: number } | null>(null);
  const timelineDragRef = useRef<{
    mode: "playhead" | "move" | "trim-start" | "trim-end";
    id?: string;
    originTime: number;
    start?: number;
    end?: number;
  } | null>(null);

  const selected = useMemo(
    () => layers.find((layer) => layer.id === selectedId),
    [layers, selectedId],
  );
  const selectedTransform = selected ? transformAt(selected, currentTime) : undefined;

  const flash = useCallback((message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(""), 1800);
  }, []);

  const updateLayer = useCallback((layerId: string, update: Partial<Layer>) => {
    setLayers((items) =>
      items.map((layer) => layer.id === layerId ? { ...layer, ...update } : layer),
    );
  }, []);

  const updateTransform = useCallback(
    (property: keyof Transform, value: number) => {
      if (!selected) return;
      setLayers((items) =>
        items.map((layer) => {
          if (layer.id !== selected.id) return layer;
          const exactIndex = layer.keyframes.findIndex(
            (frame) => Math.abs(frame.time - currentTime) < 1 / FPS,
          );
          if (exactIndex >= 0) {
            const keyframes = [...layer.keyframes];
            keyframes[exactIndex] = { ...keyframes[exactIndex], [property]: value };
            return { ...layer, keyframes };
          }
          if (layer.keyframes.length) {
            const frame: Keyframe = {
              ...transformAt(layer, currentTime),
              [property]: value,
              id: id(),
              time: currentTime,
              easing: "easeInOut",
            };
            return {
              ...layer,
              keyframes: [...layer.keyframes, frame].sort((a, b) => a.time - b.time),
            };
          }
          return { ...layer, transform: { ...layer.transform, [property]: value } };
        }),
      );
    },
    [currentTime, selected],
  );

  const addKeyframe = useCallback(() => {
    if (!selected) return;
    const current = transformAt(selected, currentTime);
    setLayers((items) =>
      items.map((layer) => {
        if (layer.id !== selected.id) return layer;
        const existing = layer.keyframes.findIndex(
          (frame) => Math.abs(frame.time - currentTime) < 1 / FPS,
        );
        const frame: Keyframe = {
          ...current,
          id: existing >= 0 ? layer.keyframes[existing].id : id(),
          time: currentTime,
          easing: existing >= 0 ? layer.keyframes[existing].easing : "easeInOut",
        };
        const keyframes = existing >= 0
          ? layer.keyframes.map((item, index) => index === existing ? frame : item)
          : [...layer.keyframes, frame];
        return { ...layer, keyframes: keyframes.sort((a, b) => a.time - b.time) };
      }),
    );
    flash(`Keyframe added at ${formatTime(currentTime)}`);
  }, [currentTime, flash, selected]);

  const deleteSelected = useCallback(() => {
    if (!selected) return;
    setLayers((items) => items.filter((layer) => layer.id !== selected.id));
    setSelectedId("");
    flash(`${selected.name} removed`);
  }, [flash, selected]);

  const addText = useCallback(() => {
    const layerId = id();
    const layer: Layer = {
      id: layerId,
      name: "New text",
      type: "text",
      start: currentTime,
      end: clamp(currentTime + 5, currentTime + 0.5, duration),
      text: "TYPE SOMETHING",
      color: "#F2F3F4",
      visible: true,
      transform: { x: 640, y: 360, z: layers.length + 1, width: 560, height: 96, rotation: 0, opacity: 1 },
      keyframes: [],
    };
    setLayers((items) => [...items, layer]);
    setSelectedId(layerId);
    flash("Text layer added");
  }, [currentTime, duration, flash, layers.length]);

  const addFiles = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(event.target.files ?? []);
      files.forEach((file, index) => {
        const type: AssetType = file.type.startsWith("video/") ? "video" : "image";
        const layerId = id();
        const source = URL.createObjectURL(file);
        const base: Layer = {
          id: layerId,
          name: file.name.replace(/\.[^/.]+$/, ""),
          type,
          start: currentTime,
          end: clamp(currentTime + 6, currentTime + 0.5, duration),
          source,
          visible: true,
          transform: {
            x: 640, y: 360, z: layers.length + index + 1,
            width: type === "video" ? 760 : 560,
            height: type === "video" ? 428 : 360,
            rotation: 0, opacity: 1,
          },
          keyframes: [],
        };
        if (type === "image") {
          const image = new Image();
          image.onload = () => {
            const scale = Math.min(760 / image.naturalWidth, 460 / image.naturalHeight, 1);
            setLayers((items) => items.map((layer) =>
              layer.id === layerId
                ? { ...layer, transform: { ...layer.transform, width: Math.round(image.naturalWidth * scale), height: Math.round(image.naturalHeight * scale) } }
                : layer,
            ));
          };
          image.src = source;
          mediaRef.current.set(layerId, image);
        } else {
          const video = document.createElement("video");
          video.src = source;
          video.muted = true;
          video.playsInline = true;
          video.preload = "auto";
          video.onloadedmetadata = () => {
            const end = clamp(currentTime + video.duration, currentTime + 0.5, duration);
            const ratio = video.videoWidth / video.videoHeight || 16 / 9;
            setLayers((items) => items.map((layer) =>
              layer.id === layerId
                ? {
                    ...layer,
                    end,
                    transform: {
                      ...layer.transform,
                      width: ratio >= 1 ? 760 : Math.round(500 * ratio),
                      height: ratio >= 1 ? Math.round(760 / ratio) : 500,
                    },
                  }
                : layer,
            ));
          };
          video.load();
          mediaRef.current.set(layerId, video);
        }
        setLayers((items) => [...items, base]);
        setSelectedId(layerId);
      });
      if (files.length) flash(`${files.length} asset${files.length > 1 ? "s" : ""} added`);
      event.target.value = "";
    },
    [currentTime, duration, flash, layers.length],
  );

  const drawMonitor = useCallback(() => {
    const canvas = monitorRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const dpr = window.devicePixelRatio || 1;
    const width = Math.round(rect.width * dpr);
    const height = Math.round(rect.height * dpr);
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const scale = rect.width / STAGE_WIDTH;
    ctx.setTransform(dpr * scale, 0, 0, dpr * scale, 0, 0);
    renderComposition(ctx, layers, currentTime, mediaRef.current, {
      selectedId,
      selectionScale: scale,
      showHud: true,
    });
  }, [currentTime, layers, selectedId]);

  const drawTimeline = useCallback(() => {
    const canvas = timelineRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const dpr = window.devicePixelRatio || 1;
    const width = Math.round(rect.width * dpr);
    const height = Math.round(rect.height * dpr);
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, rect.width, rect.height);
    ctx.fillStyle = "#131519";
    ctx.fillRect(0, 0, rect.width, rect.height);
    const labelWidth = 190;
    const rulerHeight = 29;
    const rowHeight = Math.max(34, Math.min(42, (rect.height - rulerHeight) / Math.max(layers.length, 1)));
    const timelineWidth = Math.max(10, rect.width - labelWidth);
    const timeToX = (time: number) => labelWidth + (time / duration) * timelineWidth;
    ctx.fillStyle = "#17191e";
    ctx.fillRect(0, 0, rect.width, rulerHeight);
    ctx.fillStyle = "#111317";
    ctx.fillRect(0, 0, labelWidth, rect.height);
    ctx.strokeStyle = "#292d34";
    ctx.beginPath(); ctx.moveTo(labelWidth + .5, 0); ctx.lineTo(labelWidth + .5, rect.height); ctx.stroke();
    for (let second = 0; second <= duration; second += 1) {
      const x = timeToX(second);
      const major = second % 5 === 0;
      ctx.strokeStyle = major ? "#41464e" : "#292d34";
      ctx.beginPath(); ctx.moveTo(x + .5, major ? 7 : 16); ctx.lineTo(x + .5, rulerHeight); ctx.stroke();
      if (major) {
        ctx.fillStyle = "#777c85";
        ctx.font = "9px monospace";
        ctx.textAlign = "center";
        ctx.fillText(`${second}s`, x, 11);
      }
    }
    layers.forEach((layer, index) => {
      const y = rulerHeight + index * rowHeight;
      if (layer.id === selectedId) {
        ctx.fillStyle = "rgba(214,255,67,.035)";
        ctx.fillRect(0, y, rect.width, rowHeight);
      }
      ctx.strokeStyle = "#23272d";
      ctx.beginPath(); ctx.moveTo(0, y + rowHeight); ctx.lineTo(rect.width, y + rowHeight); ctx.stroke();
      ctx.fillStyle = "#a9adb4";
      ctx.font = "600 10px Arial";
      ctx.textAlign = "left";
      const name = layer.name.length > 20 ? `${layer.name.slice(0, 18)}…` : layer.name;
      ctx.fillText(name, 14, y + rowHeight / 2 + 3);
      ctx.fillStyle = "#555b64";
      ctx.font = "8px Arial";
      ctx.fillText(layer.type.toUpperCase(), 132, y + rowHeight / 2 + 3);
      const x1 = timeToX(layer.start);
      const x2 = timeToX(layer.end);
      ctx.globalAlpha = layer.id === selectedId ? .92 : .64;
      ctx.fillStyle = layerColor(layer.type);
      ctx.beginPath(); ctx.roundRect(x1, y + 7, Math.max(4, x2 - x1), rowHeight - 14, 4); ctx.fill();
      ctx.globalAlpha = 1;
      ctx.fillStyle = "rgba(12,14,16,.76)";
      ctx.font = "600 9px Arial";
      ctx.fillText(name, x1 + 8, y + rowHeight / 2 + 3, Math.max(0, x2 - x1 - 16));
      layer.keyframes.forEach((frame) => {
        const x = timeToX(frame.time);
        const centerY = y + rowHeight / 2;
        ctx.save();
        ctx.translate(x, centerY);
        ctx.rotate(Math.PI / 4);
        ctx.fillStyle = "#f4f6f7";
        ctx.strokeStyle = "#111317";
        ctx.fillRect(-4, -4, 8, 8);
        ctx.strokeRect(-4, -4, 8, 8);
        ctx.restore();
      });
    });
    const playheadX = timeToX(currentTime);
    ctx.strokeStyle = "#ff6a55";
    ctx.beginPath(); ctx.moveTo(playheadX + .5, 0); ctx.lineTo(playheadX + .5, rect.height); ctx.stroke();
    ctx.fillStyle = "#ff6a55";
    ctx.beginPath(); ctx.moveTo(playheadX - 5, 0); ctx.lineTo(playheadX + 5, 0); ctx.lineTo(playheadX, 7); ctx.closePath(); ctx.fill();
  }, [currentTime, duration, layers, selectedId]);

  useEffect(() => {
    drawMonitor();
    drawTimeline();
  }, [drawMonitor, drawTimeline]);

  useEffect(() => {
    const onResize = () => { drawMonitor(); drawTimeline(); };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [drawMonitor, drawTimeline]);

  useEffect(() => {
    if (!isPlaying) {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
      mediaRef.current.forEach((media) => {
        if (media instanceof HTMLVideoElement) media.pause();
      });
      return;
    }
    playbackRef.current = { wall: performance.now(), time: currentTime };
    const tick = (now: number) => {
      const next = playbackRef.current.time + (now - playbackRef.current.wall) / 1000;
      if (next >= duration) {
        setCurrentTime(duration);
        setIsPlaying(false);
        return;
      }
      setCurrentTime(next);
      animationRef.current = requestAnimationFrame(tick);
    };
    animationRef.current = requestAnimationFrame(tick);
    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
    // Playback is intentionally anchored to the time when play is pressed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [duration, isPlaying]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      if (["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName)) return;
      if (event.code === "Space") {
        event.preventDefault();
        setIsPlaying((value) => !value);
      } else if (event.key === "ArrowLeft") {
        setCurrentTime((time) => clamp(time - 1 / FPS, 0, duration));
      } else if (event.key === "ArrowRight") {
        setCurrentTime((time) => clamp(time + 1 / FPS, 0, duration));
      } else if (event.key.toLowerCase() === "k") {
        addKeyframe();
      } else if (event.key === "Delete" || event.key === "Backspace") {
        deleteSelected();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [addKeyframe, deleteSelected, duration]);

  useEffect(() => () => {
    exportCancelRef.current = true;
    if (exportAnimationRef.current) {
      cancelAnimationFrame(exportAnimationRef.current);
    }
    if (
      exportRecorderRef.current &&
      exportRecorderRef.current.state !== "inactive"
    ) {
      exportRecorderRef.current.stop();
    }
    mediaRef.current.forEach((media) => {
      if (media.src.startsWith("blob:")) URL.revokeObjectURL(media.src);
    });
  }, []);

  const stagePoint = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    return {
      x: ((event.clientX - rect.left) / rect.width) * STAGE_WIDTH,
      y: ((event.clientY - rect.top) / rect.height) * STAGE_HEIGHT,
    };
  };

  const onStagePointerDown = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    const point = stagePoint(event);
    const hit = [...layers]
      .filter((layer) => layer.visible && currentTime >= layer.start && currentTime <= layer.end)
      .sort((a, b) => transformAt(b, currentTime).z - transformAt(a, currentTime).z)
      .find((layer) => {
        const transform = transformAt(layer, currentTime);
        const radians = (-transform.rotation * Math.PI) / 180;
        const dx = point.x - transform.x;
        const dy = point.y - transform.y;
        const localX = dx * Math.cos(radians) - dy * Math.sin(radians);
        const localY = dx * Math.sin(radians) + dy * Math.cos(radians);
        return Math.abs(localX) <= transform.width / 2 && Math.abs(localY) <= transform.height / 2;
      });
    if (!hit) {
      setSelectedId("");
      return;
    }
    const transform = transformAt(hit, currentTime);
    setSelectedId(hit.id);
    stageDragRef.current = { id: hit.id, offsetX: point.x - transform.x, offsetY: point.y - transform.y };
    setIsDraggingStage(true);
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const onStagePointerMove = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    const drag = stageDragRef.current;
    if (!drag) return;
    const point = stagePoint(event);
    const nextX = clamp(point.x - drag.offsetX, -STAGE_WIDTH, STAGE_WIDTH * 2);
    const nextY = clamp(point.y - drag.offsetY, -STAGE_HEIGHT, STAGE_HEIGHT * 2);
    setLayers((items) => items.map((layer) => {
      if (layer.id !== drag.id) return layer;
      const exactIndex = layer.keyframes.findIndex(
        (frame) => Math.abs(frame.time - currentTime) < 1 / FPS,
      );
      if (exactIndex >= 0) {
        const keyframes = [...layer.keyframes];
        keyframes[exactIndex] = { ...keyframes[exactIndex], x: nextX, y: nextY };
        return { ...layer, keyframes };
      }
      if (layer.keyframes.length) {
        const frame: Keyframe = {
          ...transformAt(layer, currentTime),
          x: nextX,
          y: nextY,
          id: id(),
          time: currentTime,
          easing: "easeInOut",
        };
        return {
          ...layer,
          keyframes: [...layer.keyframes, frame].sort((a, b) => a.time - b.time),
        };
      }
      return { ...layer, transform: { ...layer.transform, x: nextX, y: nextY } };
    }));
  };

  const stopStageDrag = () => {
    stageDragRef.current = null;
    setIsDraggingStage(false);
  };

  const timelineMetrics = (canvas: HTMLCanvasElement) => {
    const rect = canvas.getBoundingClientRect();
    const labelWidth = 190;
    const rulerHeight = 29;
    const rowHeight = Math.max(34, Math.min(42, (rect.height - rulerHeight) / Math.max(layers.length, 1)));
    const xToTime = (x: number) =>
      clamp(((x - labelWidth) / (rect.width - labelWidth)) * duration, 0, duration);
    return { rect, labelWidth, rulerHeight, rowHeight, xToTime };
  };

  const onTimelinePointerDown = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    const metrics = timelineMetrics(event.currentTarget);
    const x = event.clientX - metrics.rect.left;
    const y = event.clientY - metrics.rect.top;
    const time = metrics.xToTime(x);
    const rowIndex = Math.floor((y - metrics.rulerHeight) / metrics.rowHeight);
    const layer = layers[rowIndex];
    setIsPlaying(false);
    if (y < metrics.rulerHeight || !layer || x < metrics.labelWidth) {
      setCurrentTime(time);
      timelineDragRef.current = { mode: "playhead", originTime: time };
    } else {
      setSelectedId(layer.id);
      const pxPerSecond = (metrics.rect.width - metrics.labelWidth) / duration;
      const nearStart = Math.abs(time - layer.start) * pxPerSecond < 8;
      const nearEnd = Math.abs(time - layer.end) * pxPerSecond < 8;
      const keyframe = layer.keyframes.find((frame) => Math.abs(frame.time - time) * pxPerSecond < 7);
      if (keyframe) {
        setCurrentTime(keyframe.time);
        timelineDragRef.current = { mode: "playhead", originTime: keyframe.time };
      } else if (nearStart) {
        timelineDragRef.current = { mode: "trim-start", id: layer.id, originTime: time, start: layer.start, end: layer.end };
      } else if (nearEnd) {
        timelineDragRef.current = { mode: "trim-end", id: layer.id, originTime: time, start: layer.start, end: layer.end };
      } else if (time >= layer.start && time <= layer.end) {
        setCurrentTime(time);
        timelineDragRef.current = { mode: "move", id: layer.id, originTime: time, start: layer.start, end: layer.end };
      } else {
        setCurrentTime(time);
        timelineDragRef.current = { mode: "playhead", originTime: time };
      }
    }
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const onTimelinePointerMove = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    const drag = timelineDragRef.current;
    if (!drag) return;
    const metrics = timelineMetrics(event.currentTarget);
    const time = metrics.xToTime(event.clientX - metrics.rect.left);
    if (drag.mode === "playhead") {
      setCurrentTime(time);
      return;
    }
    setLayers((items) => items.map((layer) => {
      if (layer.id !== drag.id || drag.start === undefined || drag.end === undefined) return layer;
      if (drag.mode === "trim-start") return { ...layer, start: clamp(time, 0, layer.end - .2) };
      if (drag.mode === "trim-end") return { ...layer, end: clamp(time, layer.start + .2, duration) };
      const length = drag.end - drag.start;
      const start = clamp(drag.start + time - drag.originTime, 0, duration - length);
      const delta = start - layer.start;
      return {
        ...layer,
        start,
        end: start + length,
        keyframes: layer.keyframes.map((frame) => ({ ...frame, time: clamp(frame.time + delta, 0, duration) })),
      };
    }));
  };

  const exportFrame = () => {
    const canvas = document.createElement("canvas");
    canvas.width = STAGE_WIDTH;
    canvas.height = STAGE_HEIGHT;
    const context = canvas.getContext("2d");
    if (!context) return;
    renderComposition(context, layers, currentTime, mediaRef.current);
    canvas.toBlob((blob) => {
      if (!blob) return;
      downloadBlob(
        blob,
        `lumaframe-${formatTime(currentTime, true).replace(":", "-")}.png`,
      );
      flash("Current frame exported");
    }, "image/png");
  };

  const exportProject = async () => {
    if (isSavingProject) return;
    setIsSavingProject(true);
    try {
      const portableLayers = await Promise.all(
        layers.map(async (layer) => {
          if (!layer.source || !layer.source.startsWith("blob:")) return layer;
          const response = await fetch(layer.source);
          if (!response.ok) throw new Error(`Could not read ${layer.name}`);
          return {
            ...layer,
            source: await blobToDataUrl(await response.blob()),
          };
        }),
      );
      const project: ProjectFile = {
        format: "lumaframe",
        version: 1,
        name: "Product film — Scene 01",
        width: STAGE_WIDTH,
        height: STAGE_HEIGHT,
        fps: FPS,
        duration,
        createdAt: new Date().toISOString(),
        layers: portableLayers,
      };
      downloadBlob(
        new Blob([JSON.stringify(project)], {
          type: "application/vnd.lumaframe+json",
        }),
        "product-film-scene-01.lumaframe",
      );
      flash("Portable project exported");
    } catch (error) {
      flash(error instanceof Error ? error.message : "Project export failed");
    } finally {
      setIsSavingProject(false);
    }
  };

  const importProject = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    try {
      const project = JSON.parse(await file.text()) as Partial<ProjectFile>;
      if (
        project.format !== "lumaframe" ||
        project.version !== 1 ||
        !Array.isArray(project.layers)
      ) {
        throw new Error("This is not a valid LumaFrame project");
      }

      mediaRef.current.forEach((mediaItem) => {
        if (mediaItem.src.startsWith("blob:")) URL.revokeObjectURL(mediaItem.src);
      });
      mediaRef.current.clear();

      const nextLayers = project.layers as Layer[];
      nextLayers.forEach((layer) => {
        if (!layer.source || layer.type === "text") return;
        if (layer.type === "image") {
          const image = new Image();
          image.src = layer.source;
          mediaRef.current.set(layer.id, image);
        } else {
          const video = document.createElement("video");
          video.src = layer.source;
          video.muted = true;
          video.playsInline = true;
          video.preload = "auto";
          video.load();
          mediaRef.current.set(layer.id, video);
        }
      });

      setLayers(nextLayers);
      setDuration(
        typeof project.duration === "number" && project.duration > 0
          ? project.duration
          : INITIAL_DURATION,
      );
      setCurrentTime(0);
      setSelectedId(nextLayers[0]?.id ?? "");
      setIsPlaying(false);
      flash(`${file.name} opened`);
    } catch (error) {
      flash(error instanceof Error ? error.message : "Could not open project");
    }
  };

  const exportVideo = () => {
    if (exportProgress !== null) return;
    if (
      typeof MediaRecorder === "undefined" ||
      typeof HTMLCanvasElement.prototype.captureStream !== "function"
    ) {
      flash("Video export is not supported in this browser");
      return;
    }

    const canvas = document.createElement("canvas");
    canvas.width = STAGE_WIDTH;
    canvas.height = STAGE_HEIGHT;
    const context = canvas.getContext("2d");
    if (!context) return;

    const mimeType = [
      "video/webm;codecs=vp9",
      "video/webm;codecs=vp8",
      "video/webm",
    ].find((type) => MediaRecorder.isTypeSupported(type));
    if (!mimeType) {
      flash("This browser cannot encode WebM video");
      return;
    }

    setIsPlaying(false);
    exportCancelRef.current = false;
    setExportProgress(0);
    const stream = canvas.captureStream(FPS);
    const recorder = new MediaRecorder(stream, {
      mimeType,
      videoBitsPerSecond: 8_000_000,
    });
    exportRecorderRef.current = recorder;
    const chunks: BlobPart[] = [];
    recorder.ondataavailable = (event) => {
      if (event.data.size) chunks.push(event.data);
    };
    recorder.onerror = () => {
      stream.getTracks().forEach((track) => track.stop());
      setExportProgress(null);
      exportRecorderRef.current = null;
      flash("Video export failed");
    };
    recorder.onstop = () => {
      stream.getTracks().forEach((track) => track.stop());
      exportRecorderRef.current = null;
      setExportProgress(null);
      if (!exportCancelRef.current && chunks.length) {
        downloadBlob(
          new Blob(chunks, { type: mimeType }),
          "product-film-scene-01.webm",
        );
        flash("Video export complete");
      }
    };

    const startedAt = performance.now();
    const renderExportFrame = (now: number) => {
      if (exportCancelRef.current) {
        if (recorder.state !== "inactive") recorder.stop();
        return;
      }
      const time = clamp((now - startedAt) / 1000, 0, duration);
      renderComposition(context, layers, time, mediaRef.current);
      setExportProgress(time / duration);
      if (time >= duration) {
        window.setTimeout(() => {
          if (recorder.state !== "inactive") recorder.stop();
        }, 120);
        return;
      }
      exportAnimationRef.current = requestAnimationFrame(renderExportFrame);
    };

    renderComposition(context, layers, 0, mediaRef.current);
    recorder.start(250);
    exportAnimationRef.current = requestAnimationFrame(renderExportFrame);
  };

  const cancelVideoExport = () => {
    exportCancelRef.current = true;
    if (exportAnimationRef.current) {
      cancelAnimationFrame(exportAnimationRef.current);
    }
    if (
      exportRecorderRef.current &&
      exportRecorderRef.current.state !== "inactive"
    ) {
      exportRecorderRef.current.stop();
    }
    setExportProgress(null);
    flash("Video export cancelled");
  };

  const selectedFrameIndex = selected?.keyframes.findIndex(
    (frame) => Math.abs(frame.time - currentTime) < 1 / FPS,
  );
  const currentEasing =
    selectedFrameIndex !== undefined && selectedFrameIndex >= 0
      ? selected?.keyframes[selectedFrameIndex].easing
      : "easeInOut";

  return (
    <main className="editor">
      {toast && <div className="toast">{toast}</div>}
      {exportProgress !== null && (
        <div className="export-overlay" role="status" aria-live="polite">
          <div className="export-card">
            <div className="export-card-heading">
              <span>Rendering video</span>
              <strong>{Math.round(exportProgress * 100)}%</strong>
            </div>
            <div className="export-meter">
              <span style={{ width: `${exportProgress * 100}%` }} />
            </div>
            <p>
              Rendering 1280 × 720 at 30 FPS in real time. Keep this tab open.
            </p>
            <button
              className="ghost-button"
              type="button"
              onClick={cancelVideoExport}
            >
              Cancel export
            </button>
          </div>
        </div>
      )}
      <header className="topbar">
        <div className="brand"><span className="brand-mark" aria-hidden="true" />LUMAFRAME</div>
        <div className="project-name">Product film <span>/</span> Scene 01</div>
        <span className="saved-pill">Local session</span>
        <button
          className="icon-button"
          type="button"
          aria-label="Show keyboard shortcuts"
          title="Space: play · K: keyframe · ← →: frame · Delete: remove"
          onClick={() => flash("Space: play · K: keyframe · ← →: step · Delete: remove")}
        >?</button>
        <button
          className="ghost-button"
          type="button"
          onClick={() => projectRef.current?.click()}
        >
          Open project
        </button>
        <input
          ref={projectRef}
          type="file"
          hidden
          accept=".lumaframe,application/json,application/vnd.lumaframe+json"
          onChange={importProject}
        />
        <button
          className="ghost-button"
          type="button"
          disabled={isSavingProject}
          onClick={exportProject}
        >
          {isSavingProject ? "Packing…" : "Save project"}
        </button>
        <button
          className="ghost-button"
          type="button"
          onClick={exportFrame}
        >
          Frame PNG
        </button>
        <button
          className="primary-button"
          type="button"
          disabled={exportProgress !== null}
          onClick={exportVideo}
        >
          Export video
        </button>
      </header>

      <section className="workspace">
        <aside className="panel assets-panel">
          <div className="panel-heading">
            <h2>Media</h2>
            <span style={{ color: "#666b73", fontSize: 10 }}>{layers.length} layers</span>
          </div>
          <div className="asset-actions">
            <button className="add-button" type="button" onClick={() => uploadRef.current?.click()}>
              <strong>＋</strong>Upload media
            </button>
            <button className="add-button" type="button" onClick={addText}>
              <strong style={{ fontFamily: "Georgia, serif" }}>T</strong>Add text
            </button>
            <input ref={uploadRef} type="file" hidden multiple accept="image/*,video/*" onChange={addFiles} />
          </div>
          <p className="section-label">Composition</p>
          <div className="layers">
            {[...layers].sort((a, b) => b.transform.z - a.transform.z).map((layer) => (
              <button
                key={layer.id}
                className={`layer-card ${selectedId === layer.id ? "selected" : ""}`}
                type="button"
                onClick={() => {
                  setSelectedId(layer.id);
                  setCurrentTime(clamp(currentTime, layer.start, layer.end));
                }}
              >
                <span className={`layer-thumb ${layer.type}`}>
                  {layer.type === "text" ? "T" : layer.type === "video" ? "▶" : "▧"}
                </span>
                <span className="layer-copy">
                  <strong>{layer.name}</strong>
                  <span>{layer.type} · {formatTime(layer.end - layer.start, true)}</span>
                </span>
                <span className="layer-visibility">●</span>
              </button>
            ))}
          </div>
        </aside>

        <section className="stage">
          <div className="stage-toolbar">
            <div className="stage-toolbar-group"><span className="stage-badge">Fit 67%</span><span>1280 × 720</span></div>
            <div className="stage-toolbar-group"><span>Drag objects to position</span><span className="stage-badge">16:9</span></div>
          </div>
          <div className="canvas-wrap">
            <div className="monitor-shell">
              <canvas
                ref={monitorRef}
                className={`monitor-canvas ${isDraggingStage ? "dragging" : ""}`}
                aria-label="Composition preview canvas"
                onPointerDown={onStagePointerDown}
                onPointerMove={onStagePointerMove}
                onPointerUp={stopStageDrag}
                onPointerCancel={stopStageDrag}
              />
            </div>
          </div>
          <div className="stage-footer">
            <span>RGB / 30 FPS</span>
            <span>{isPlaying ? "PLAYING" : "READY"} · {layers.filter((layer) => layer.visible).length} VISIBLE</span>
          </div>
        </section>

        <aside className="panel inspector">
          <div className="panel-heading">
            <h2>Inspector</h2>
            {selected && <button className="icon-button" type="button" aria-label="Delete layer" onClick={deleteSelected}>×</button>}
          </div>
          {!selected || !selectedTransform ? (
            <div className="empty-inspector">Select a layer on the canvas or timeline to edit its properties.</div>
          ) : (
            <>
              {selected.type === "text" && (
                <div className="field-section">
                  <div className="field-section-title">Text</div>
                  <div className="field-grid">
                    <div className="field full">
                      <label htmlFor="text-content">Content</label>
                      <textarea
                        id="text-content"
                        value={selected.text}
                        onChange={(event) => updateLayer(selected.id, {
                          text: event.target.value,
                          name: event.target.value.split("\n")[0] || "Text",
                        })}
                      />
                    </div>
                    <div className="field full">
                      <label htmlFor="text-color">Color</label>
                      <input id="text-color" type="color" value={selected.color} onChange={(event) => updateLayer(selected.id, { color: event.target.value })} />
                    </div>
                  </div>
                </div>
              )}
              <div className="field-section">
                <div className="field-section-title">Timing <span>{formatTime(selected.end - selected.start, true)}</span></div>
                <div className="field-grid">
                  <NumberField label="Start" value={selected.start} step={.1} onChange={(value) => updateLayer(selected.id, { start: clamp(value, 0, selected.end - .2) })} />
                  <NumberField label="End" value={selected.end} step={.1} onChange={(value) => updateLayer(selected.id, { end: clamp(value, selected.start + .2, duration) })} />
                </div>
              </div>
              <div className="field-section">
                <div className="field-section-title">Transform <span>Stage px</span></div>
                <div className="field-grid">
                  <NumberField label="X" value={selectedTransform.x} onChange={(value) => updateTransform("x", value)} />
                  <NumberField label="Y" value={selectedTransform.y} onChange={(value) => updateTransform("y", value)} />
                  <NumberField label="Width" value={selectedTransform.width} min={1} onChange={(value) => updateTransform("width", Math.max(1, value))} />
                  <NumberField label="Height" value={selectedTransform.height} min={1} onChange={(value) => updateTransform("height", Math.max(1, value))} />
                  <NumberField label="Rotation" value={selectedTransform.rotation} onChange={(value) => updateTransform("rotation", value)} />
                  <NumberField label="Depth Z" value={selectedTransform.z} onChange={(value) => updateTransform("z", value)} />
                  <div className="field full">
                    <label htmlFor="opacity">Opacity</label>
                    <div className="range-row">
                      <input id="opacity" type="range" min="0" max="1" step=".01" value={selectedTransform.opacity} onChange={(event) => updateTransform("opacity", Number(event.target.value))} />
                      <span style={{ color: "#9ca1a9", fontSize: 10 }}>{Math.round(selectedTransform.opacity * 100)}%</span>
                    </div>
                  </div>
                </div>
              </div>
              <div className="field-section">
                <div className="field-section-title">Animation <span>{selected.keyframes.length} keys</span></div>
                <div className="field full" style={{ marginBottom: 10 }}>
                  <label htmlFor="easing">Transition</label>
                  <select
                    id="easing"
                    value={currentEasing}
                    onChange={(event) => {
                      const easing = event.target.value as Easing;
                      setLayers((items) => items.map((layer) => {
                        if (layer.id !== selected.id) return layer;
                        const index = layer.keyframes.findIndex((frame) => Math.abs(frame.time - currentTime) < 1 / FPS);
                        if (index < 0) return layer;
                        return { ...layer, keyframes: layer.keyframes.map((frame, frameIndex) => frameIndex === index ? { ...frame, easing } : frame) };
                      }));
                    }}
                  >
                    <option value="linear">Linear</option>
                    <option value="easeIn">Ease in</option>
                    <option value="easeOut">Ease out</option>
                    <option value="easeInOut">Ease in &amp; out</option>
                  </select>
                </div>
                <button className="keyframe-button" type="button" onClick={addKeyframe}>
                  <span className="diamond" />Add keyframe at {formatTime(currentTime)}
                </button>
                <div className="keyframe-list">
                  {selected.keyframes.map((frame) => (
                    <button key={frame.id} className="keyframe-chip" type="button" onClick={() => setCurrentTime(frame.time)} title={`${frame.easing} · click to jump`}>
                      ◆ {formatTime(frame.time, true)}
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}
        </aside>
      </section>

      <section className="timeline" aria-label="Timeline editor">
        <div className="timeline-toolbar">
          <div className="timeline-label">Timeline</div>
          <div className="transport">
            <button className="icon-button" type="button" aria-label="Previous frame" onClick={() => setCurrentTime((time) => clamp(time - 1 / FPS, 0, duration))}>‹</button>
            <button
              className="transport-button"
              type="button"
              aria-label={isPlaying ? "Pause" : "Play"}
              onClick={() => {
                if (currentTime >= duration) setCurrentTime(0);
                setIsPlaying((value) => !value);
              }}
            >{isPlaying ? "Ⅱ" : "▶"}</button>
            <button className="icon-button" type="button" aria-label="Next frame" onClick={() => setCurrentTime((time) => clamp(time + 1 / FPS, 0, duration))}>›</button>
            <span className="timecode">{formatTime(currentTime)} <span>/ {formatTime(duration)}</span></span>
          </div>
          <div className="timeline-tools"><span>Drag clips to move · edges to trim</span></div>
        </div>
        <div className="timeline-canvas-wrap">
          <canvas
            ref={timelineRef}
            className="timeline-canvas"
            aria-label="Canvas timeline with layers and keyframes"
            onPointerDown={onTimelinePointerDown}
            onPointerMove={onTimelinePointerMove}
            onPointerUp={() => { timelineDragRef.current = null; }}
            onPointerCancel={() => { timelineDragRef.current = null; }}
          />
        </div>
      </section>
    </main>
  );
}

function NumberField({
  label,
  value,
  onChange,
  step = 1,
  min,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  step?: number;
  min?: number;
}) {
  const fieldId = `field-${label.toLowerCase().replace(/\s/g, "-")}`;
  return (
    <div className="field">
      <label htmlFor={fieldId}>{label}</label>
      <input
        id={fieldId}
        type="number"
        min={min}
        step={step}
        value={Number(value.toFixed(2))}
        onChange={(event) => onChange(Number(event.target.value))}
      />
    </div>
  );
}
