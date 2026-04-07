import { defineConfig } from "vite";

const repoName = process.env.GITHUB_REPOSITORY?.split("/")[1];
const isGhPagesBuild = process.env.GITHUB_ACTIONS === "true" && !!repoName;

export default defineConfig({
  base: isGhPagesBuild ? `/${repoName}/` : "/",
  worker: {
    format: "es",
  },
});
