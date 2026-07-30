import type { Metadata } from "next";
import "./editor.css";
import { VideoEditor } from "../video-editor";

export const metadata: Metadata = {
  title: "LumaFrame — Canvas motion editor",
  description:
    "Compose, animate, save, and export video projects from a browser canvas.",
};

export default function EditorPage() {
  return <VideoEditor />;
}
