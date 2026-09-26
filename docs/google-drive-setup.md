# Turning on "Save to Google Drive" (one time, about 10 minutes)

Nightjar saves each novel as a file in the writer's own Google Drive. Google needs to know
the app exists, so someone creates a free "OAuth client ID" once. Nothing here costs money,
and no password or secret is involved: the client ID is public and only names the app.

1. Go to https://console.cloud.google.com and sign in with any Google account (yours is fine).
2. At the top, click the project picker → **New project**. Name it `Nightjar` → **Create**, then make sure it's selected.
3. Search the top bar for **Google Drive API** → open it → **Enable**.
4. Search for **Google Auth Platform** (it may also appear as "OAuth consent screen") → **Get started**.
   - App name: `Nightjar`. User support email: your email. **Next**.
   - Audience: **External**. **Next**.
   - Contact email: your email. **Next** → agree → **Create**.
5. In the left menu choose **Audience** → **Publish app** → **Confirm**. (This lets any Google account sign in, not just test users. The app only asks for the limited "files it creates" permission, so Google doesn't require a review.)
6. Left menu → **Data access** → **Add or remove scopes** → tick `.../auth/drive.file` → **Update** → **Save**.
7. Left menu → **Clients** → **Create client**.
   - Application type: **Web application**. Name: `Nightjar web`.
   - Under **Authorized JavaScript origins** click **Add URI** and enter `https://nickjw.github.io`
   - **Create**.
8. Copy the **Client ID** (it ends in `.apps.googleusercontent.com`) and send it over. It goes into `src/config.ts`.

That's it. After the next update, Settings shows **Save my novel to Google Drive**, and the
welcome screen on a new computer shows **Continue from Google Drive**.

## What she'll see

- The first time: a Google window asks which account to use and to allow Nightjar to
  "see, edit, create and delete only the specific Google Drive files you use with this app".
- While writing: her novel saves to Drive about every 20 seconds after changes. The menu
  says "Saved on this computer and in your Google Drive."
- Google's sign-in lasts about an hour at a time. Nightjar renews it on her next button click,
  which may briefly flash a small Google window. If that doesn't work, a calm banner offers
  **Connect**.
- On another laptop: open the Nightjar link → **Continue from Google Drive** → pick the novel.
- If she wrote on two laptops without them syncing in between, nothing is lost: Nightjar opens
  the newest Drive version and keeps the other as "(this computer's version)".
- Google Drive also keeps its own version history of the file.
