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

const videoFilePath =
  "/home/ali/Videos/TV Series/The Office/The.Office.US.SEASON.01.S01.COMPLETE.720p.WEBRip.2CH.x265.HEVC-PSA/The.Office.US.S01E01.Pilot.720p.WEBRip.2CH.x265.HEVC-PSA.mkv";

const searchPhrases = ["That's what she said", "Michael Scott"];

const outputDir = "mashups_the_office";
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
        videoFilePath,
        ctx.searchPhrase
      );
      ctx.subtitleChunks = subtitleChunks;
      task.title = `Found ${subtitleChunks.length} occurrences of ${ctx.searchPhrase}`;
    },
  },
  {
    title: "Create clips folder",
    skip: (ctx) => ctx.subtitleChunks.length === 0,
    task: async (ctx, task) => {
      createDir(clipsDir);
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
              videoFilePath,
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
    skip: (ctx) => ctx.subtitleChunks.length === 0,
    task: async () => {
      createDir(outputDir);
    },
  },
  {
    title: "Join clips",
    skip: (ctx) => ctx.subtitleChunks.length === 0,
    task: async (ctx) => {
      const fileName = encodeFileName(ctx.searchPhrase);
      await joinClips(fileName, clipsDir, outputDir);
    },
  },
  {
    title: "Remove clips",
    skip: (ctx) => ctx.subtitleChunks.length === 0,
    task: async () => {
      await fs.rm("clips", { recursive: true, force: true });
    },
  },
]);

console.time("Total time");

for (const searchPhrase of searchPhrases) {
  await tasks.run({ searchPhrase } as Ctx);
}

console.timeEnd("Total time");
