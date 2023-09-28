import fs from "fs/promises";
import { Listr } from "listr2";
import { Cue, formatTimestamp } from "subtitle";
import {
  createDir,
  cutClip,
  encodeFileName,
  findPhraseInSubtitleFile,
  joinClips,
} from "./utils";

const videoFile =
  "/Users/azuy/Videos/TV Series/Modern Family Season 1-11 Complete 720p x264 [Pahe.in]/Modern Family Season 1 BluRay 720p x264 - Pahe.in/Modern.Family.S01E01.720p.BluRay.x264.150MB-Pahe.in.mkv";

const outputDir = "mashups";
const clipsDir = "clips";

interface Ctx {
  searchPhrase: string;
  subtitleChunks: Cue[];
}

const tasks = new Listr<Ctx>([
  {
    title: "Find phrases in subtitle file",
    task: async (ctx, task) => {
      const subtitleChunks = await findPhraseInSubtitleFile(
        videoFile.replace(".mkv", ".srt"),
        ctx.searchPhrase
      );
      ctx.subtitleChunks = subtitleChunks;
      task.title = `Found ${subtitleChunks.length} occurrences of ${ctx.searchPhrase}`;
    },
  },
  {
    title: "Create clips folder",
    task: async (ctx, task) => {
      await createDir(clipsDir);
    },
  },
  {
    title: "Cut clips",
    skip: (ctx) => ctx.subtitleChunks.length === 0,
    task: (ctx, task) =>
      task.newListr(
        ctx.subtitleChunks.map((subtitle, index) => ({
          title: `Cutting clip ${index} from ${formatTimestamp(
            subtitle.start
          )} to ${formatTimestamp(subtitle.end)}`,
          task: async () => {
            await cutClip(
              videoFile,
              formatTimestamp(subtitle.start, { format: "WebVTT" }),
              formatTimestamp(subtitle.end, { format: "WebVTT" }),
              `${clipsDir}/${encodeFileName(ctx.searchPhrase)}_${index}.mkv`
            );
          },
        })),
        {
          concurrent: true,
          rendererOptions: { collapseSubtasks: false, collapseErrors: false },
        }
      ),
  },
  {
    title: "Create output folder",
    task: async () => {
      await createDir(outputDir);
    },
  },
  {
    title: "Join clips",
    task: async (ctx) => {
      const fileName = encodeFileName(ctx.searchPhrase);
      await joinClips(fileName, clipsDir, outputDir);
    },
  },
  {
    title: "Remove clips",
    task: async () => {
      await fs.rm("clips", { recursive: true, force: true });
    },
  },
]);

console.time("Total time");

await tasks.run({
  searchPhrase: "Mom",
} as Ctx);

console.timeEnd("Total time");
