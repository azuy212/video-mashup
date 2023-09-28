import { execa } from "execa";
import fs from "fs";
import { Node, NodeCue, parseSync } from "subtitle";

export function cutClip(
  input: string,
  startTime: string,
  endTime: string,
  output: string
) {
  console.log(`Cutting clip from ${startTime} to ${endTime}`);
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

export function findPhraseInSubtitleFile(subtitleFile: string, phrase: string) {
  const srtFile = fs.readFileSync(subtitleFile, "utf-8");
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

function createConcatFile(clips: string[], output: string) {
  const concatFile = clips.map((clip) => `file '../${clip}'`).join("\n");
  const concatFileName = `concat_${output.replace(".mkv", ".txt")}`;
  const outputDir = output.split("/")[0];
  fs.existsSync(`concat_${outputDir}`) || fs.mkdirSync(`concat_${outputDir}`);
  fs.writeFileSync(concatFileName, concatFile);
  return concatFileName;
}

export function joinClips(clips: string[], output: string) {
  console.log(`Joining ${clips.length} clips into ${output}`);
  const concatFileName = createConcatFile(clips, output);
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

  return ffmpegProcess;
}
