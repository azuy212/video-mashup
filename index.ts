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
  "/Users/azuy/Videos/TV Series/The.Office.US.SEASON.09.S09.COMPLETE.720p.BluRay.2CH.x265.HEVC-PSA/The.Office.US.S09E01.The.New.Guys.720p.BluRay.2CH.x265.HEVC-PSA.mkv";

const searchPhrase = "Pam";

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
        videoFilePath,
        ctx.searchPhrase
      );
      ctx.subtitleChunks = subtitleChunks;
      task.title = `Found ${subtitleChunks.length} occurrences of ${ctx.searchPhrase}`;
    },
  },
  {
    title: "Create clips folder",
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
    task: async () => {
      createDir(outputDir);
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
  searchPhrase,
} as Ctx);

console.timeEnd("Total time");
