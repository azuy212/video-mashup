import { execa } from "execa";
import fs from "fs";
import { Node, NodeCue, formatTimestamp, parseSync } from "subtitle";

const videoFile =
  "/Users/azuy/Videos/TV Series/Modern Family Season 1-11 Complete 720p x264 [Pahe.in]/Modern Family Season 1 BluRay 720p x264 - Pahe.in/Modern.Family.S01E01.720p.BluRay.x264.150MB-Pahe.in.mkv";

const searchPhrase = "Phil";

const cutClip = async (
  input: string,
  startTime: string,
  endTime: string,
  output: string
) => {
  return execa("ffmpeg", [
    "-i",
    input,
    "-ss",
    startTime,
    "-to",
    endTime,
    "-c:v",
    "libx264",
    "-crf",
    "23",
    "-c:a",
    "aac",
    output,
  ]);
};

const isCue = (node: Node): node is NodeCue => node.type === "cue";

const findPhrasesInSubtitleFile = (subtitleFile: string, phrase: string) => {
  const srtFile = fs.readFileSync(subtitleFile, "utf-8");
  const subtitles = parseSync(srtFile);

  return (
    subtitles
      .filter(isCue)
      .map((subtitle) => subtitle.data)
      // find all the subtitles that contain the phrase but not the phrase with narrator as phrase
      .filter(
        (subtitle) =>
          subtitle.text.includes(phrase) &&
          !subtitle.text.includes(`[${phrase}]`)
      )
  );
};

const joinClips = async (clips: string[], output: string) => {
  const concatFile = clips.map((clip) => `file '${clip}'`).join("\n");
  fs.writeFileSync("concat.txt", concatFile);
  return execa("ffmpeg", [
    "-f",
    "concat",
    "-safe",
    "0",
    "-i",
    "concat.txt",
    "-c",
    "copy",
    "-y",
    output,
  ]);
};

await Promise.all(
  findPhrasesInSubtitleFile(
    videoFile.replace(".mkv", ".srt"),
    searchPhrase
  ).map(async (subtitle, index) => {
    return cutClip(
      videoFile,
      formatTimestamp(subtitle.start, { format: "WebVTT" }),
      formatTimestamp(subtitle.end, { format: "WebVTT" }),
      `clips/${searchPhrase.replace(" ", "_")}_${index}.mkv`
    );
  })
);

await joinClips(
  fs.readdirSync("clips").map((clip) => `clips/${clip}`),
  `${searchPhrase.replace(" ", "_")}.mkv`
);

console.log("done");
