import "server-only";
import { cache } from "react";
import { connection } from "next/server";

// Read time once as request data, then use that fixed value to render all rows.
export const readHistoryTime = cache(async (): Promise<number> => {
  await connection();
  return Date.now();
});
