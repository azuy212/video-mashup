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
  "/Users/azuy/Videos/TV Series/Modern Family Season 1-11 Complete 720p x264 [Pahe.in]/Modern Family Season 1 BluRay 720p x264 - Pahe.in/Modern.Family.S01E01.720p.BluRay.x264.150MB-Pahe.in.mkv";

const searchPhrases = ["Oh My God", "Hello"];

const outputDir = "mashups_modern_family";
const clipsDir = "clips";

interface Ctx {
  searchPhrases: string[];
  subtitleChunks: Record<string, Cue[]>;
}

const allTasks = new Listr<Ctx>({
  title: `Create Mashup Videos for ${searchPhrases.join(", ")}`,
  task: (ctx, task) =>
    task.newListr<Ctx>(
      ctx.searchPhrases.map((searchPhrase) => ({
        title: `Creating mashup for ${searchPhrase}`,
        task: (ctx, subTask) =>
          subTask.newListr<Ctx>(
            [
              {
                title: "Find phrases in subtitle file",
                task: async (ctx, task) => {
                  const subtitleChunks = await findPhraseInSubtitleFile(
                    videoFilePath,
                    searchPhrase
                  );
                  ctx.subtitleChunks = {
                    ...ctx.subtitleChunks,
                    [searchPhrase]: subtitleChunks,
                  };
                  task.output = `Found ${subtitleChunks.length} occurrences of ${searchPhrase}`;
                },
                rendererOptions: { persistentOutput: true },
              },
              {
                title: "Create clips folder",
                skip: (ctx) => ctx.subtitleChunks[searchPhrase]?.length === 0,
                task: async (ctx, task) => {
                  createDir(clipsDir);
                },
                rendererOptions: { persistentOutput: true },
              },
              {
                title: "Cut clips",
                skip: (ctx) => ctx.subtitleChunks[searchPhrase]?.length === 0,
                task: (ctx, task) =>
                  task.newListr(
                    ctx.subtitleChunks[searchPhrase].map((subtitle, index) => ({
                      title: `Cutting clip ${index} from ${formatTimestamp(
                        subtitle.start
                      )} to ${formatTimestamp(
                        subtitle.end
                      )} ${subtitle.text.replace("\n", " ")}`,
                      task: async () => {
                        await cutClip(
                          videoFilePath,
                          formatTimestamp(subtitle.start, { format: "WebVTT" }),
                          formatTimestamp(subtitle.end, { format: "WebVTT" }),
                          `${clipsDir}/${encodeFileName(
                            searchPhrase
                          )}_${index}.mkv`
                        );
                      },
                    })),
                    {
                      concurrent: true,
                      exitOnError: true,
                      rendererOptions: {
                        collapseSubtasks: false,
                        collapseErrors: false,
                      },
                    }
                  ),
              },
              {
                title: "Create output folder",
                skip: (ctx) => ctx.subtitleChunks[searchPhrase]?.length === 0,
                task: async () => {
                  createDir(outputDir);
                },
              },
              {
                title: "Join clips",
                skip: (ctx) => ctx.subtitleChunks[searchPhrase]?.length === 0,
                task: async (ctx) => {
                  const fileName = encodeFileName(searchPhrase);
                  await joinClips(fileName, clipsDir, outputDir);
                },
              },
              {
                title: "Remove clips",
                skip: (ctx) => ctx.subtitleChunks[searchPhrase]?.length === 0,
                task: async () => {
                  // await fs.rm("clips", { recursive: true, force: true });
                  await Promise.all(
                    ctx.subtitleChunks[searchPhrase].map((subtitle, index) =>
                      fs.unlink(
                        `${clipsDir}/${encodeFileName(
                          searchPhrase
                        )}_${index}.mkv`
                      )
                    )
                  );
                },
              },
            ],
            {
              concurrent: false,
            }
          ),
      })),
      {
        concurrent: true,
        rendererOptions: { collapseSubtasks: false, collapseErrors: false },
      }
    ),
});

console.time("Total time");
await allTasks.run({ searchPhrases } as Ctx);
console.timeEnd("Total time");
