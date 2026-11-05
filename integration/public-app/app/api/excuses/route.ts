import { generateFromSharedChain } from "../../../lib/generate-from-shared-chain";
import { createClient } from "../../../lib/supabase/server";
import { gameCharacters } from "../../../lib/game-characters";

export const maxDuration = 300;

export async function POST(request: Request) {
  // Reject requests coming from a different website.
  if (request.headers.get("origin") !== new URL(request.url).origin) {
    return Response.json({ error: "Invalid request origin." }, { status: 403 });
  }

  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return Response.json(
      { error: "Sign in to generate an excuse." },
      { status: 401 },
    );
  }

  let body;

  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid request." }, { status: 400 });
  }

  if (!body || typeof body !== "object") {
    return Response.json({ error: "Invalid request." }, { status: 400 });
  }

  const game = body.game;
  let character =
    typeof body.character === "string" ? body.character.trim() : "";
  const situation =
    typeof body.situation === "string" ? body.situation.trim() : "";

  if (
    (game !== "valorant" && game !== "league" && game !== "overwatch") ||
    character.length > 100 ||
    situation.length < 5 ||
    situation.length > 1000
  ) {
    return Response.json(
      {
        error:
          "Choose a game, use at most 100 characters for your character, " +
          "and describe what happened in 5–1000 characters.",
      },
      { status: 400 },
    );
  }

  if (character) {
    const matchingCharacter = (gameCharacters[game] ?? []).find(
      (name) => name.toLowerCase() === character.toLowerCase(),
    );

    if (!matchingCharacter) {
      return Response.json(
        {
          error:
            "Choose a character from the selected game's roster, " +
            "or leave the character field blank.",
        },
        { status: 400 },
      );
    }

    character = matchingCharacter;
  }

  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    return Response.json(
      { error: "Excuse generation is not configured yet." },
      { status: 503 },
    );
  }

  let generated;
  try {
    generated = await generateFromSharedChain({ userId: user.id, game, character, situation });
  } catch {
    return Response.json({ error: "Could not complete excuse generation. Please try again." }, { status: 502 });
  }
  if (!generated.ok) return Response.json({ error: generated.error }, { status: generated.status });
  const { excuse, prompt } = generated;

  const { data, error } = await supabase
    .from("excuse_drafts")
    .insert({
      user_id: user.id,
      game,
      character_name: character || null,
      situation,
      prompt,
      excuse,
    })
    .select("id, game, character_name, situation, excuse, created_at")
    .single();

  if (error) {
    console.error("Could not save draft:", error.message);

    return Response.json(
      {
        error: "The excuse was generated but its preview could not be saved.",
      },
      { status: 500 },
    );
  }

  return Response.json({ draft: data }, { status: 201 });
}
