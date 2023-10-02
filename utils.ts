import { execa } from "execa";
import fs from "fs";
import { Node, NodeCue, parseSync } from "subtitle";

export function encodeFileName(fileName: string) {
  return fileName.replace(/[^a-z0-9]/gi, "_");
}

export function createDir(dir: string) {
  if (fs.existsSync(dir)) {
    return;
  }
  return fs.mkdirSync(dir);
}

export function parseSubtitles(subtitleFilePath: string) {
  const subtitleFile = fs.readFileSync(subtitleFilePath, "utf-8");
  return parseSync(subtitleFile);
}

async function getSubtitles(videoFilePath: string) {
  const subtitleFilePath = videoFilePath.replace(".mkv", ".srt");
  if (fs.existsSync(subtitleFilePath)) {
    return parseSubtitles(subtitleFilePath);
  }

  // Extract subtitles from video
  await execa("ffmpeg", [
    "-i",
    subtitleFilePath.replace(".srt", ".mkv"),
    "-map",
    "0:s:0",
    subtitleFilePath,
  ]);

  if (fs.existsSync(subtitleFilePath)) {
    const subtitles = parseSubtitles(subtitleFilePath);
    // fs.unlinkSync(subtitleFilePath);
    return subtitles;
  }

  throw new Error(`Could not find subtitle file for ${videoFilePath}`);
}

const isCue = (node: Node): node is NodeCue => node.type === "cue";

export async function findPhraseInVideoFile(
  videoFilePath: string,
  phrase: string
) {
  const subtitles = await getSubtitles(videoFilePath);

  return (
    subtitles
      .filter(isCue)
      .map((subtitle) => subtitle.data)
      // find all the subtitles that contain the phrase but not the phrase with narrator as phrase
      .filter(
        (subtitle) =>
          subtitle.text.toLowerCase().includes(phrase.toLowerCase()) &&
          // Exclude phrases like [Narrator] or Narrator: from the search
          !(
            subtitle.text.toLowerCase().includes(`[${phrase.toLowerCase()}]`) ||
            subtitle.text.toLowerCase().includes(`${phrase.toLowerCase()}: `)
          )
      )
  );
}

export function findPhraseInVideoFolder(
  folderPath: string,
  phrase: string
) {
  return Promise.all(
    fs
    .readdirSync(folderPath)
    .filter((fileName) => fileName.endsWith('.mkv'))
    .sort()
    .map(async (fileName) => {
      const videoFilePath = `${folderPath}/${fileName}`;
      const subtitleChunks = await findPhraseInVideoFile(videoFilePath, phrase);
      return {
        videoFilePath,
        subtitleChunks,
      };
    })
  )
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
    "-preset",
    "ultrafast",
    output,
  ]);

  // ffmpegProcess.stdout?.pipe(process.stdout);
  // ffmpegProcess.stderr?.pipe(process.stderr);

  return ffmpegProcess;
}

function getClips(fileName: string, clipsDir: string) {
  const clips = fs.readdirSync(clipsDir);
  return clips
    .sort((a, b) => {
      const aIndex = parseInt(a.split("_")[1].split(".")[0]);
      const bIndex = parseInt(b.split("_")[1].split(".")[0]);
      return aIndex - bIndex;
    })
    .filter((clip) => clip.startsWith(fileName))
    .map((clip) => `${clipsDir}/${clip}`);
}

async function createConcatFile(fileName: string, clipsDir: string) {
  const clips = getClips(fileName, clipsDir);
  const concatFileData = clips.map((clip) => `file '${clip}'`).join("\n");
  const concatFileName = `${fileName}.txt`;
  fs.writeFileSync(concatFileName, concatFileData);
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
  fs.unlinkSync(concatFileName);
}
