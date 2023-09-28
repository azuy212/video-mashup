import { execa } from "execa";
import fs from "fs/promises";
import { Node, NodeCue, parseSync } from "subtitle";

export function encodeFileName(fileName: string) {
  return fileName.replace(/[^a-z0-9]/gi, "_");
}

export async function createDir(dir: string) {
  if (await fs.exists(dir)) {
    return;
  }
  return fs.mkdir(dir);
}

export function cutClip(
  input: string,
  startTime: string,
  endTime: string,
  output: string
) {
  const ffmpegProcess = execa("ffmpeg", [
    "-i",
    input,
    "-ss",
    startTime,
    "-to",
    endTime,
    "-c:v",
    "libx264",
    "-preset",
    "ultrafast",
    "-c:a",
    "aac",
    output,
  ]);

  // ffmpegProcess.stdout?.pipe(process.stdout);
  // ffmpegProcess.stderr?.pipe(process.stderr);

  return ffmpegProcess;
}

const isCue = (node: Node): node is NodeCue => node.type === "cue";

export async function findPhraseInSubtitleFile(
  subtitleFile: string,
  phrase: string
) {
  const srtFile = await fs.readFile(subtitleFile, "utf-8");
  const subtitles = parseSync(srtFile);

  return (
    subtitles
      .filter(isCue)
      .map((subtitle) => subtitle.data)
      // find all the subtitles that contain the phrase but not the phrase with narrator as phrase
      .filter(
        (subtitle) =>
          subtitle.text.toLowerCase().includes(phrase.toLowerCase()) &&
          !subtitle.text.toLowerCase().includes(`[${phrase.toLowerCase()}]`)
      )
  );
}

async function getClips(fileName: string, clipsDir: string) {
  const clips = await fs.readdir(clipsDir);
  return clips
    .sort()
    .filter((clip) => clip.startsWith(fileName))
    .map((clip) => `${clipsDir}/${clip}`);
}

async function createConcatFile(fileName: string, clipsDir: string) {
  const clips = await getClips(fileName, clipsDir);
  const concatFileData = clips.map((clip) => `file '${clip}'`).join("\n");
  const concatFileName = `${fileName}.txt`;
  await fs.writeFile(concatFileName, concatFileData);
  return concatFileName;
}

export async function joinClips(
  fileName: string,
  clipsDir: string,
  outputDir: string
) {
  const output = `${outputDir}/${fileName}.mkv`;
  const concatFileName = await createConcatFile(fileName, clipsDir);
  const ffmpegProcess = execa("ffmpeg", [
    "-f",
    "concat",
    "-safe",
    "0",
    "-i",
    concatFileName,
    "-c",
    "copy",
    "-y",
    output,
  ]);

  // ffmpegProcess.stdout?.pipe(process.stdout);
  // ffmpegProcess.stderr?.pipe(process.stderr);

  await ffmpegProcess;
  await fs.unlink(concatFileName);
}
