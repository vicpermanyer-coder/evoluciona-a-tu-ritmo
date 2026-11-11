<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.

## What Lovable manages

Rules outside this block are the project's own. Change the pieces below in
Lovable, not by hand. With the [Lovable MCP](https://mcp.lovable.dev)
connected, `send_message` asks Lovable to do it; otherwise ask the user to
use the editor.

- **Database.** Do not add or edit `supabase/migrations/` or `drizzle/`.
  Ask Lovable to change the schema.
- **Generated files.** Do not edit a file whose header says it is automatically
  generated.
- **AI gateway.** Keep model calls on Lovable's gateway, and keep
  `LOVABLE_API_KEY` out of browser code.
- **Connectors.** Lovable provides native connectors. `list_connectors` shows
  which are enabled; `add_connector` only returns the dashboard link. When a
  connector is enabled, calls go through the connector gateway and need
  `LOVABLE_API_KEY`. When Lovable does not provide one, users can bring their
  own key and store it in Secrets.
- **Secrets.** Lovable manages them. Do not put secret values in the repo.
<!-- LOVABLE:END -->

## Project rules
- XP, challenge completions and habit logs are written only through the `complete_challenge` / `toggle_habit` security-definer RPCs; unique constraints on `xp_events(source_type, source_id)` and `challenge_completions(challenge_id)` are what prevent double rewards.
- Derive a challenge's "done" state from `challenge_completions` rows for the user and local date (via `markCompleted`), never from an embedded PostgREST relation: the one-to-one FK makes the embed return an object, not an array.
- Daily dates are the user's local calendar date (`localDate()`), passed to the backend explicitly.
- Daily challenges are created only by the `ensureDailyChallenges` server function (curated library in `src/lib/evolve.ts`) via the service-role-only `insert_daily_challenges` RPC; users have no INSERT/DELETE on `daily_challenges`, so they cannot forge XP or reset completed challenges.
- A day's challenge set is never modified once created; preference changes apply from the next local day.
- Goals, intensity and name are saved together through the `save_preferences` RPC (security invoker, single transaction) so a failed save never leaves a user without goals.
