import { defineConfig } from "@neon/config/v1";

export default defineConfig({
  preview: {
    buckets: {
      "sampark-sheet": { access: "private" },
    },
  },
});
