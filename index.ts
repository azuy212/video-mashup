import fs from "fs";
import { formatTimestamp } from "subtitle";
import { cutClip, findPhraseInSubtitleFile, joinClips } from "./utils";

const videoFile =
  "/Users/azuy/Videos/TV Series/Modern Family Season 1-11 Complete 720p x264 [Pahe.in]/Modern Family Season 1 BluRay 720p x264 - Pahe.in/Modern.Family.S01E01.720p.BluRay.x264.150MB-Pahe.in.mkv";

const outputDir = "mashups";

const searchPhrases = ["Wow", "God"];

console.time("Total time");

await Promise.all(
  searchPhrases.map(async (searchPhrase) => {
    const subtitleChunks = findPhraseInSubtitleFile(
      videoFile.replace(".mkv", ".srt"),
      searchPhrase
    );

    console.log(
      `Found ${subtitleChunks.length} occurrences of ${searchPhrase}`
    );

    if (subtitleChunks.length === 0) {
      return;
    }

    fs.existsSync("clips") || fs.mkdirSync("clips");

    const searchPhraseFileName = searchPhrase.replace(" ", "_");

    await Promise.all(
      subtitleChunks.map(async (subtitle, index) =>
        cutClip(
          videoFile,
          formatTimestamp(subtitle.start, { format: "WebVTT" }),
          formatTimestamp(subtitle.end, { format: "WebVTT" }),
          `clips/${searchPhraseFileName}_${index}.mkv`
        )
      )
    );

    fs.existsSync(outputDir) || fs.mkdirSync(outputDir);

    await joinClips(
      fs
        .readdirSync("clips")
        .sort()
        .filter((clip) => clip.startsWith(searchPhraseFileName))
        .map((clip) => `clips/${clip}`),
      `${outputDir}/${searchPhraseFileName}.mkv`
    );
  })
);

console.log(`Removing clips and concat folders`);
fs.rmSync(`concat_${outputDir}`, { recursive: true, force: true });
fs.rmSync("clips", { recursive: true, force: true });

console.timeEnd("Total time");
