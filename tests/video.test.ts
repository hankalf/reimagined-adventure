import { describe, expect, it } from "vitest";
import { videoEmbed } from "@/lib/video";

describe("videoEmbed", () => {
  it("handles YouTube, Vimeo and direct files", () => {
    expect(videoEmbed("https://www.youtube.com/watch?v=abc123XYZ")).toEqual({ kind: "iframe", src: "https://www.youtube-nocookie.com/embed/abc123XYZ" });
    expect(videoEmbed("https://youtu.be/abc123XYZ?t=4")).toEqual({ kind: "iframe", src: "https://www.youtube-nocookie.com/embed/abc123XYZ" });
    expect(videoEmbed("https://vimeo.com/12345678")).toEqual({ kind: "iframe", src: "https://player.vimeo.com/video/12345678" });
    expect(videoEmbed("https://cdn.example.com/msg.mp4?x=1")).toEqual({ kind: "video", src: "https://cdn.example.com/msg.mp4?x=1" });
  });
  it("rejects junk", () => {
    expect(videoEmbed("")).toBeNull();
    expect(videoEmbed("not a url")).toBeNull();
    expect(videoEmbed("https://example.com/page")).toBeNull();
  });
});
