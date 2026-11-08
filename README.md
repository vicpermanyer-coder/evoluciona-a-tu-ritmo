# Evoluciona A Tu Ritmo

Build a production-oriented, mobile-first AI self-improvement web application called EVOLVE, inspired by the functionality of Critique AI but with completely original branding, design and copy.

Use React, TypeScript, Tailwind CSS and Supabase (or the platform's supported persistent backend). The UI must be in Spanish.

Design: premium dark theme, charcoal background, violet accent, elegant typography, smooth interactions, bottom navigation on mobile and sidebar on desktop.

Implement:

1. Authentication: email signup, login, logout, protected routes and persistent user sessions.

2. Onboarding: user selects goals (fitness, nutrition, style, confidence, habits), preferred daily challenge intensity and display name.

3. Dashboard: personalized greeting, daily XP, current level, streak, challenge completion progress and quick access to AI coach.

4. Challenges: generate an initial set of daily challenges based on onboarding choices. Allow marking complete once per day, award XP once, persist completion and reset daily challenges based on user's local date.

5. Habits: create custom habits, check them off daily and view a 7-day history.

6. AI Coach: working chat UI, persistent conversation history, backend endpoint prepared for a securely stored AI API key. Never expose keys in frontend. If AI is not configured, clearly display 'AI no configurada' instead of pretending to generate responses.

7. Progress: real charts based on saved challenge completions and XP, levels and streak history.

8. Profile: edit goals and display name, logout and delete account/data.

9. Image analysis: create an upload screen with categories outfit, food and exercise; secure private storage; mark actual AI analysis as 'Próximamente' until a real vision model is connected. Do not fabricate image scores or calorie estimates.

Data models: profiles, goals, daily_challenges, challenge_completions, habits, habit_logs, xp_events, conversations, messages and image_uploads. Apply per-user access controls / row-level security. Prevent duplicate XP rewards using database constraints.

Provide loading, empty and error states, accessible controls, responsive layouts, and realistic Spanish microcopy. Do not use hardcoded demo data as if it were real user data.

Build the app in stages, prioritizing functional authentication, onboarding, dashboard, challenge completion and persistent data. Clearly report which features work end-to-end and which still require configuration. Do not claim the app is production ready until tested.

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://evoluciona-a-tu-ritmo.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/fa541810-29a9-59ad-9613-bf32ad592b48).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
