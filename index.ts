import fs from "fs/promises";
import { Listr } from "listr2";
import { Cue, formatTimestamp } from "subtitle";
import { createDir, cutClip, encodeFileName, findPhraseInVideoFolder, joinClips } from "./utils";

const videoFilePath =
  "/home/ali/Videos/TV Series/The Office/The.Office.US.SEASON.01.S01.COMPLETE.720p.WEBRip.2CH.x265.HEVC-PSA";

const searchPhrases = ["Kevin"];

const outputDir = "mashups_the_office";
const clipsDir = "clips";

interface Ctx {
  searchPhrases: string[];
  subtitleChunks: Record<
    string,
    Array<{
      videoFilePath: string;
      subtitleChunks: Cue[];
    }>
  >;
  totalSubtitleChunks: Record<string, number>;
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
                  const subtitleChunks = await findPhraseInVideoFolder(videoFilePath, searchPhrase);
                  ctx.subtitleChunks = {
                    ...ctx.subtitleChunks,
                    [searchPhrase]: subtitleChunks,
                  };
                  const totalSubtitleChunks = subtitleChunks.reduce((acc, s) => acc + s.subtitleChunks.length, 0);
                  ctx.totalSubtitleChunks = {
                    ...ctx.totalSubtitleChunks,
                    [searchPhrase]: totalSubtitleChunks,
                  };
                  task.output = `Found ${totalSubtitleChunks} occurrences of ${searchPhrase} in ${subtitleChunks.length} files`;
                },
                rendererOptions: { persistentOutput: true },
              },
              {
                title: "Create clips folder",
                skip: (ctx) => ctx.totalSubtitleChunks[searchPhrase] === 0,
                task: async (ctx, task) => {
                  createDir(clipsDir);
                },
                rendererOptions: { persistentOutput: true },
              },
              {
                title: "Cut clips",
                skip: (ctx) => ctx.totalSubtitleChunks[searchPhrase] === 0,
                task: (ctx, task) =>
                  task.newListr(
                    ctx.subtitleChunks[searchPhrase].map(({ subtitleChunks, videoFilePath }, sIndex) => ({
                      title: `${sIndex + 1} Cutting ${subtitleChunks.length} clips from ${videoFilePath.split('/').pop()}`,
                      skip: (ctx) => subtitleChunks.length === 0,
                      task: (ctx, task) => {
                        return task.newListr(
                          subtitleChunks.map((subtitle, index) => ({
                            title: `Cutting clip ${index} from ${formatTimestamp(subtitle.start)} to ${formatTimestamp(
                              subtitle.end,
                            )} ${subtitle.text.replace("\n", " ")}`,
                            task: async () => {
                              await cutClip(
                                videoFilePath,
                                formatTimestamp(subtitle.start, { format: "WebVTT" }),
                                formatTimestamp(subtitle.end, { format: "WebVTT" }),
                                `${clipsDir}/${encodeFileName(searchPhrase)}_${sIndex}_${index}.mkv`,
                              );
                            },
                          })),
                        );
                      },
                    })),
                    {
                      concurrent: false,
                      exitOnError: true,
                      rendererOptions: {
                        collapseSubtasks: false,
                        collapseErrors: false,
                      },
                    },
                  ),
              },
              {
                title: "Create output folder",
                skip: (ctx) => ctx.totalSubtitleChunks[searchPhrase] === 0,
                task: async () => {
                  createDir(outputDir);
                },
              },
              {
                title: "Join clips",
                skip: (ctx) => ctx.totalSubtitleChunks[searchPhrase] === 0,
                task: async (ctx) => {
                  const fileName = encodeFileName(searchPhrase);
                  await joinClips(fileName, clipsDir, outputDir);
                },
              },
              {
                title: "Remove clips",
                skip: (ctx) => ctx.totalSubtitleChunks[searchPhrase] === 0,
                task: async () => {
                  // await fs.rm("clips", { recursive: true, force: true });
                  await Promise.all(
                    ctx.subtitleChunks[searchPhrase].flatMap((subtitles, sIndex) =>
                      subtitles.subtitleChunks.map((subtitle, index) =>
                        fs.unlink(`${clipsDir}/${encodeFileName(searchPhrase)}_${sIndex}_${index}.mkv`),
                      ),
                    ),
                  );
                },
              },
            ],
            {
              concurrent: false,
            },
          ),
      })),
      {
        concurrent: false,
        rendererOptions: { collapseSubtasks: false, collapseErrors: false },
      },
    ),
});

console.time("Total time");
await allTasks.run({ searchPhrases } as Ctx);
console.timeEnd("Total time");
