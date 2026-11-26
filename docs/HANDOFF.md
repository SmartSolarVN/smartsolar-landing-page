# Handoff: self-hosting the smartsolar.com.vn landing page

> Note: this file lives in `docs/` and must not be published to GitHub Pages.

## Goal

https://smartsolar.com.vn/ is built and hosted on **Ycode Cloud** (a no-code builder, served behind Vercel). We want the site as plain HTML/CSS/JS in this directory (`/home/phrimp/work/smartsolar/landing_page`) so we can deploy it ourselves and leave Ycode.

## What's done

1. **How we got the code.** Ycode's *Static HTML Export* only runs on self-hosted Ycode ([docs](https://docs.ycode.com/docs/integrations/apps/static-export)). The user restored the Cloud project into a local self-hosted Ycode (Docker container `ycode-app-1`, port 3002) using Backup & Restore ([docs](https://docs.ycode.com/docs/deployment/backup)), then exported to `/app/out` inside the container.
2. **The export was copied here unchanged:** 119 files, 67 MB, byte-identical to the container's `/app/out`. Nothing has been edited, and this directory is **not a git repo yet**.
3. You can't scrape the live site with curl or WebFetch: Vercel's security checkpoint returns HTTP 429. Use the export, or a real browser (the claude-in-chrome extension) to compare with production.

## What's in the export

- **Pages, Vietnamese (default, `lang="vi"`):** `index.html`, `about/`, `company-updates/`, `contact-us/`, 3 article pages at the root (`smartsolar-tim-doi-tac-epc-…`, and two near-duplicate `thong-cao-bao-chi-…-315-trieu-usd-…` press releases), plus `401.html`, `404.html` and `500.html`.
- **Pages, English (`en/`):** `index.html`, `about/`, `company-updates/`, `contact-us/`. There are **no English article pages**.
- **Assets:** `a/<id>/<file>` (mostly webp, a few png/svg), referenced by document-relative paths (`../a/...`). Also `swiper-minimal.css` at the root.
- **CSS:** Tailwind CSS is inlined into each page.
- **Interactions:** stored as a JSON blob `<script id="ycode-interactions">` with an inline runner. Only `click` triggers are used, so no animation was lost in the export.
- **There is no remaining Ycode, Supabase or Vercel runtime dependency.**

## Problems found in the export (none fixed yet)

1. **Forms don't send anywhere:** there are 3 forms, e.g. in `contact-us/index.html`, `<form action="" method="POST">`, with no JS submit handler.
2. **Broken `{slug}` links:** `company-updates/index.html` and `en/company-updates/index.html` link "read more" to `../{slug}/index.html`, an unfilled placeholder.
3. **Missing English article:** `en/company-updates` links to the live `https://smartsolar.com.vn/en/tin-tuc-cap-nhat/press-release-smartsolar-raises-3-15-m-swiss-german-financing`, which wasn't exported. There are about 24 other absolute `https://smartsolar.com.vn/...` links.
4. **Missing image:** `a/5CCD5w4kqYcYbjCKtMEOnF/dltn-hero-photo-2.webp`, referenced from inline CSS `url(...)`.
5. **External runtime dependencies:**
   - Google Fonts files from `fonts.gstatic.com` (Manrope, Inter)
   - Swiper from `cdn.jsdelivr.net/npm/swiper@12/...` (unpinned)
   - Google Analytics gtag `G-X64TG707PS`
   - Zalo SDK `sp.zalo.me/plugins/sdk.js`
6. **Images aren't resized:** `srcset` entries use `?width=320…1920&quality=85`, but these all point to the same full-size file. Ycode resized images on request; a static host won't.
7. **Template leftovers:** footer social links go to plain `https://dribbble.com` and `https://x.com`.

## Confirmed decisions (2026-11-26)

- **Q4:** this directory becomes its own git repo, separate from the monorepo. It will be pushed to GitHub later.
- **Q6:** SmartSolar owns the content. Manrope and Inter (SIL OFL) may be self-hosted.
- **Q8:** from now on, edit the HTML/CSS/JS directly. Ycode was only used for this one export.
- **Q11:** forms post to a new public endpoint on the Go backend that creates a CRM lead, with rate limiting and a honeypot.
- **Q12 (partial):** fix the image `srcset`s, the template footer links and the duplicate press release directly in the code.
- **Q13:** rebuild the English article, keep one of the two press releases, and redirect old URLs.
- **Q14:** self-host the fonts and a pinned Swiper version. GA and Zalo keep loading from their own servers.
- **Q15:** resize images with `sharp` and point `srcset` at the resized files.
- **Q5:** host on **GitHub Pages**. Remote: `git@github.com:SmartSolarVN/smartsolar-landing-page.git`, branch `main`. GitHub Pages has no server-side redirects.
- **Q12:** fix every problem by hand, once. The only script is a one-off `sharp` script for images, committed to the repo.
- **Q16:** replace the footer social links with the real accounts shown on the live site, and remove the rest.
- **Q17:** download the missing hero image from the live site, or remove the reference if it's missing there too.
- **Q18:** keep GA `G-X64TG707PS`.
- **Q11 / Q25 (deferred):** no backend lead endpoint for now, so CORS is not needed yet.
- **Q20:** a GitHub Actions workflow publishes only the site files (not `docs/` or scripts).
- **Q21:** old URLs become meta-refresh pages, each with a canonical link and a visible link to the new page.
- **Q22:** `smartsolar.com.vn` (no www) is the main address, and `www` redirects to it. Turn on Enforce HTTPS and verify the domain in the org. **The user handles DNS.**
- **Q23:** first deploy to `smartsolarvn.github.io/smartsolar-landing-page/`, compare it with production, then add `CNAME` and switch DNS.
- **Q24:** the repo is public. **The user handles this on GitHub.**
- **Q26:** until there's a backend, each form becomes a contact block: phone `0084765601250`, `hello@smartsolar.com.vn`, and Zalo `https://zalo.me/22721196108995464` (the Zalo Official Account ID from the chat widget). The original form HTML stays in the code, commented out.
- **Q27:** the deploy workflow leaves out `401.html` and `500.html`.
- **Q28:** add `robots.txt` and `sitemap.xml` with `hreflang` tags. Submit the sitemap to Search Console after the domain switch.
- **Q19 (done):** `git init -b main` with `origin` set and no commits, a `.gitignore` added, and this file moved to `docs/`.

## Original open decisions (kept for reference)

The recommended answers below were given to the user; see "Confirmed decisions" above for what was decided:

- **Q4, repo:** make this directory its own git repo, separate from the monorepo? *Recommended: yes.*
- **Q5, hosting:** Firebase Hosting, an nginx container on Cloud Run, a GCS bucket behind a CDN, or Cloudflare Pages? *Recommended: Firebase Hosting (static, on GCP, nothing billed to keep it running).*
- **Q6, licensing:** confirm we own the content and check that the fonts are licensed for self-hosting. Ycode itself is MIT, so it's not a concern.
- **Q8, where edits happen:** edit HTML/CSS/JS directly from now on, with Ycode used only for this one export? Or keep self-hosted Ycode and re-export? *Recommended: edit the code directly.* This decides Q12.
- **Q11, forms:** post to a new public endpoint on the SmartSolar Go backend (monorepo, `internal/modules/...`) that creates a CRM lead, with rate limiting and a honeypot or captcha? *Recommended: yes.* The alternatives are Formspree or Web3Forms.
- **Q12, how to fix problems 2–7:** edit by hand once, or write a repeatable post-export script? *Recommended: edit by hand once, if Q8 is "edit the code directly".*
- **Q13, articles and redirects:** get or rebuild the English article, keep one of the two duplicate press releases, and redirect old URLs (including `/en/tin-tuc-cap-nhat/...`) so links from news sites keep working. *Recommended: yes.*
- **Q14, local copies:** host the fonts and a pinned Swiper version locally, and keep GA and Zalo loading from their own servers. *Recommended: yes.*
- **Q15, images:** generate real resized versions at build time (e.g. with a `sharp` script) and point `srcset` at them. *Recommended: yes.*

Once these are settled, the next round of questions follows from them: the URL and redirect map against production, the domain and DNS cutover, `404.html` wiring on the host, analytics continuity, and how to verify against the live site before cutover.

## User constraints

- **Never run `git commit`**, and don't stage files the user didn't ask about. Leave changes in the working tree and list the changed files for the user.
- The user prefers rounds of numbered questions, each with a recommended answer, before any implementation.

## Suggested skills

- `mattpocock-skills:grilling`: finish the open-decision tree above before implementing.
- `claude-in-chrome` / `anthropic-skills:chrome-browser`: compare the export with the live site, which a plain fetch can't reach.
- `run`: serve the site locally (e.g. `npx serve .`) and check pages.
- `mobile-native`: when fixing images and layout for phones.
- `mattpocock-skills:tdd`: if Q11 adds a backend lead endpoint in the monorepo.

## Implementation status (2026-11-26)

Done. Nothing is committed. Originals are only in the untracked export, so diffs start at the first commit.

Chrome wasn't connected, so production facts came from the Wayback Machine (web.archive.org), and the English article text from its 2026-04-11 snapshot.

- **Links:** fixed the `{slug}` links and the absolute `smartsolar.com.vn/company-updates|contact-us` links (English pages now link the `en/` versions). Fixed the press-release cards: the Vietnamese card points to the Vietnamese article, the English card to the new English article. No English EPC article exists anywhere, so the English card links the Vietnamese one.
- **Language switcher:** it was a dead Ycode dropdown on every page (an extra export bug). It's now a plain link to the same page in the other language.
- **English article:** `en/press-release-smartsolar-raises-3-15-m-swiss-german-financing/`, built from the Vietnamese article template, with the English header and footer.
- **Duplicate press release:** kept `thong-cao-…-len-315-…-thuysi-va-duc` (it is the only copy with mailto links). `…-len3-15-…-thuy-si-va-duc` is now a redirect page.
- **Redirect pages** (meta-refresh, canonical, noindex): earlier production slugs of the press release (`/tin-tuc-cap-nhat/…`, `/smartsolar-nang-tong-von-…`, `/press-release-…`, and both `/en/…` variants), `/tin-tuc-cap-nhat`, and the 2024–25 site's `/contact`, `/blog/*`, `/en/contact` and `/en/blog/*`. The blog posts no longer exist, so they redirect to company updates.
- **"Missing" hero image:** it was never missing. The about pages used a root-absolute `url(/a/…)`, which broke under the github.io sub-path; it's now relative.
- **Self-hosted files:** fonts in `fonts/` (with OFL licenses) and Swiper 12.2.0 in `vendor/`.
- **Images:** `npm run images` (`scripts/resize-images.mjs`, using sharp) wrote 739 `-<width>w.webp` files, and every `srcset` points at them. It's safe to re-run.
- **Template leftovers:** the empty `x.com` and `dribbble.com` links were in the team cards on the about pages, not the footer, and are removed. The footer's Facebook, LinkedIn and Instagram links were already real.
- **Forms:** the lead forms on the home and contact pages (both languages) are replaced by call, Zalo and email buttons. The original `<form>` markup is commented out next to them. The homepage calculator subtitle was rewritten to match.
- **Other fixes:** `&amp;amp;` in titles, and `404.html` (root-absolute paths, plus a broken `mailto`).
- **New files:** `robots.txt`, `sitemap.xml` (with hreflang) and `.github/workflows/pages.yml`, which publishes everything except `docs/`, `scripts/`, the npm files, `401.html` and `500.html`.

**Known leftovers, not fixed:**
- `404.html` uses root-absolute paths, so it looks unstyled on the github.io preview but is correct on the custom domain.
- The English homepage still has some Vietnamese strings ("Đã xuất hiện trên", the form placeholders that are now commented out).
- `sizes` attributes are as Ycode wrote them; desktop browsers still pick the largest version.

## Task list (every decision settled 2026-11-26)

**Claude:**
1. Look up on the live site in Chrome: the URL list for redirects, which press release to keep, the English article's content, the real social media accounts, and the missing hero image.
2. Fix the `{slug}` links and the ~24 absolute `smartsolar.com.vn` links.
3. Rebuild the English press-release article.
4. Remove the duplicate press release and add a meta-refresh page at its old URL.
5. Add meta-refresh pages for the old URLs (`/en/tin-tuc-cap-nhat/...` and others).
6. Restore the missing hero image, or remove its reference.
7. Host the Manrope/Inter fonts and a pinned Swiper version in the repo. GA and Zalo stay on their own servers.
8. Write a one-off `sharp` script for images, generate the 320–1920 sizes, and update every `srcset`.
9. Replace the footer social links with the real accounts.
10. Replace the 3 forms with contact blocks (Q26).
11. Add `robots.txt` and `sitemap.xml`.
12. Add `.github/workflows/pages.yml`, publishing only the site files without `docs/`, `401.html`, `500.html` or scripts.
13. Serve the site locally and check every page, including at phone width.

**User:**
- Make the repo public, commit, push to `origin main`, and set Pages → Source: GitHub Actions.
- After the github.io preview looks right: add the `CNAME` file (or have Claude add it), set the A/AAAA records and the `www` CNAME record, verify the domain in the org, and turn on Enforce HTTPS.
- Submit the sitemap to Search Console.

**Later:** a Go backend lead endpoint for the forms (Q11), with CORS (Q25).
