import { chromium, type Page } from "playwright";
import * as fs from "fs";
import * as path from "path";
import { log, type LogLevel } from "./logger";

export interface AttendanceScrapeResult {
  sabhaDate: Date;
  rows: ScrapedRow[];
  /**
   * A present row carries `subtitle` when the Sampark row showed the
   * "SABHA_NAME | DD/MM/YYYY" line — the member actually attended another
   * Sabha on that other date. Absent rows never have a subtitle.
   */
  present: Array<{ name: string; subtitle?: string }>;
  absent: Array<{ name: string; subtitle?: string }>;
  samparkCounts: SamparkCounts;
  countValidation: AttendanceCountValidation;
}

export interface ScrapedRow {
  name: string;
  isPresent: boolean;
  htmlSnippet: string;
  /** Raw "SABHA_NAME | DD/MM/YYYY" subtitle text, only on present rows. */
  subtitle?: string;
}

export interface ScrapeAttendanceOptions {
  sabhaName?: string;
  sabhaPattern?: RegExp;
}

interface BottomCounts {
  present: number | null;
  absent: number | null;
  total: number | null;
}

export interface SamparkCounts {
  present: number;
  absent: number;
  total: number;
}

export interface AttendanceCountValidation {
  matched: boolean;
  scanPasses: number;
  sampark: SamparkCounts;
  scraped: SamparkCounts;
}


const DEFAULT_SABHA_NAME = "Chirag Nagar (Kishore)";
const MONTHS: Record<string, number> = {
  jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
  jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
};

function requireEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

/** Mask a phone number for logs: keep first 2 and last 2 digits. */
function maskPhone(value: string): string {
  const digits = value.replace(/\D/g, "");
  if (digits.length <= 4) return "*".repeat(digits.length);
  return digits.slice(0, 2) + "*".repeat(digits.length - 4) + digits.slice(-2);
}

/**
 * Capture the current page URL, a slice of its visible text, and a screenshot
 * into the `runs/` folder. Used when an expected element never appears so we can
 * tell apart a block page, a blank/failed SPA, a captcha, or just a slow load —
 * especially when the scrape behaves differently on a server than locally.
 */
async function dumpPageState(
  page: Page,
  tag: string,
  networkLog?: string[],
  level: LogLevel = "ERROR"
): Promise<void> {
  try {
    const dir = path.resolve(process.cwd(), "runs");
    fs.mkdirSync(dir, { recursive: true });
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    const base = path.join(dir, `${tag}-${stamp}`);

    const url = page.url();
    const title = await page.title().catch(() => "");
    const bodyText = (await page.evaluate(() => document.body?.innerText ?? "").catch(() => "")) as string;

    log("ERROR", `Diagnostic [${tag}] — URL: ${url}`);
    log("ERROR", `Diagnostic [${tag}] — title: "${title}"`);
    log("ERROR", `Diagnostic [${tag}] — page text (first 400 chars): ${JSON.stringify(bodyText.slice(0, 400))}`);

    // Recent API/network activity — shows whether a backend call was rejected
    // (e.g. 403/451 / connection failure) versus a purely front-end issue.
    const recentNet = (networkLog ?? []).slice(-25);
    if (recentNet.length) {
      log("ERROR", `Diagnostic [${tag}] — recent network calls:\n  ${recentNet.join("\n  ")}`);
    }

    await page.screenshot({ path: `${base}.png`, fullPage: true }).catch(() => {});
    const netSection = recentNet.length ? `\n\n=== Recent network calls ===\n${recentNet.join("\n")}` : "";
    fs.writeFileSync(`${base}.txt`, `URL: ${url}\nTitle: ${title}\n\n${bodyText}${netSection}`);
    log("ERROR", `Diagnostic [${tag}] — saved screenshot and text to ${base}.{png,txt}`);
  } catch (e) {
    log("WARN", `Could not capture diagnostic for "${tag}": ${(e as Error).message}`);
  }
}

function parseSabhaDate(text: string): Date {
  const match = text.match(/\b(\d{1,2})[-\s/]([A-Za-z]{3,9})(?:[-\s/](\d{2,4}))?\b/);
  if (!match) throw new Error("Could not find Sabha date in attendance page text");

  const day = Number(match[1]);
  const month = MONTHS[match[2].slice(0, 3).toLowerCase()];
  if (month === undefined) throw new Error(`Unsupported month in Sabha date: ${match[2]}`);

  const currentYear = new Date().getFullYear();
  const parsedYear = match[3] ? Number(match[3]) : currentYear;
  const year = parsedYear < 100 ? 2000 + parsedYear : parsedYear;

  return new Date(year, month, day);
}

async function fillOtp(page: Page, password: string): Promise<void> {
  // Wait for OTP inputs to be present
  await page.waitForSelector("input.otp-input", { timeout: 20_000 });
  await page.waitForTimeout(500);

  // Use evaluate to focus — avoids Playwright's click actionability check
  // which fails when Angular overlays cover the input
  await page.evaluate(() => {
    const first = document.querySelector<HTMLInputElement>("input.otp-input");
    if (first) first.focus();
  });
  await page.waitForTimeout(200);

  // Type digits one by one with keyboard
  for (const digit of password) {
    await page.keyboard.press(digit);
    await page.waitForTimeout(180);
  }

  // Verify the values landed correctly
  await page.waitForTimeout(500);
  const values: string[] = await page.evaluate(() =>
    Array.from(document.querySelectorAll<HTMLInputElement>("input.otp-input")).map((el) => el.value)
  );
  const filled = values.slice(0, password.length).join("");

  if (filled !== password) {
    log("WARN", `OTP keyboard approach filled "${filled}", retrying via JS value injection`);
    // Fallback: inject values directly and fire Angular-compatible events
    await page.evaluate((pwd) => {
      const inputs = Array.from(document.querySelectorAll<HTMLInputElement>("input.otp-input"));
      inputs.forEach((input, i) => {
        if (i >= pwd.length) return;
        const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
          window.HTMLInputElement.prototype,
          "value"
        )?.set;
        nativeInputValueSetter?.call(input, pwd[i]);
        input.dispatchEvent(new Event("input", { bubbles: true }));
        input.dispatchEvent(new KeyboardEvent("keyup", { bubbles: true, key: pwd[i] }));
      });
    }, password);
    await page.waitForTimeout(500);
  }

  log("INFO", "OTP entered");
}


/**
 * Collapse scraped rows into unique present/absent entries keyed by name,
 * preserving the subtitle of the first observed row for each name
 * (deduped across all scan passes just like uniqueNames did).
 */
function uniqueEntries(rows: ScrapedRow[]): Array<{ name: string; subtitle?: string }> {
  const byName = new Map<string, { name: string; subtitle?: string }>();
  for (const row of rows) {
    const name = row.name.trim();
    if (!name || byName.has(name)) continue;
    byName.set(name, { name, subtitle: row.subtitle });
  }
  return Array.from(byName.values());
}

function requireBottomCounts(counts: BottomCounts): SamparkCounts {
  if (counts.present === null || counts.absent === null || counts.total === null) {
    throw new Error(
      `Could not read complete Sampark counts (present=${counts.present}, ` +
        `absent=${counts.absent}, total=${counts.total}). Refusing to update Google Sheets.`
    );
  }
  return { present: counts.present, absent: counts.absent, total: counts.total };
}

function rowCounts(rows: ScrapedRow[]): SamparkCounts {
  const present = rows.filter((row) => row.isPresent).length;
  const absent = rows.length - present;
  return { present, absent, total: rows.length };
}

function sameCounts(left: SamparkCounts, right: SamparkCounts): boolean {
  return (
    left.present === right.present &&
    left.absent === right.absent &&
    left.total === right.total
  );
}

export async function scrapeAttendance(options: ScrapeAttendanceOptions = {}): Promise<AttendanceScrapeResult> {
  const websiteUrl = process.env.WEBSITE_URL?.trim() || "https://m.sampark369.org/";
  const phoneNumber = requireEnv("PHONE_NUMBER");
  const password = requireEnv("PASSWORD");
  const sabhaName = options.sabhaName ?? process.env.SABHA_NAME?.trim() ?? DEFAULT_SABHA_NAME;
  const sabhaPattern = options.sabhaPattern ?? new RegExp(`^${sabhaName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i");

  log("INFO", `Opening Sampark app to read ${sabhaName} attendance...`);
  const browser = await chromium.launch({
    headless: true,
    // Linux servers (especially running as root or inside containers) cannot
    // start Chromium's sandbox and fail to launch without these flags. Local
    // dev on Windows/macOS keeps the sandbox enabled.
    args: process.platform === "linux" ? ["--no-sandbox", "--disable-setuid-sandbox"] : [],
  });
  // Optional proxy — set SCRAPER_PROXY_SERVER (e.g. an India-based proxy) to make
  // the scrape appear to originate from India. Sampark geo-blocks foreign/datacenter
  // IPs (e.g. a German VPS), which prevents the login page from rendering.
  const proxyServer = process.env.SCRAPER_PROXY_SERVER?.trim();
  const proxy = proxyServer
    ? {
        server: proxyServer,
        username: process.env.SCRAPER_PROXY_USERNAME?.trim() || undefined,
        password: process.env.SCRAPER_PROXY_PASSWORD?.trim() || undefined,
      }
    : undefined;
  if (proxy) log("INFO", `Routing scrape through proxy: ${proxyServer}`);

  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    // A realistic mobile UA, India locale and timezone so the Sampark SPA behaves
    // the same on a headless server as it does locally (the default headless UA
    // advertises "HeadlessChrome", which some sites treat differently).
    userAgent:
      "Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 " +
      "(KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36",
    locale: "en-IN",
    timezoneId: "Asia/Kolkata",
    ...(proxy ? { proxy } : {}),
  });
  await context.clearCookies();
  await context.clearPermissions();
  const page = await context.newPage();

  const cdpSession = await context.newCDPSession(page);
  await cdpSession.send("Network.clearBrowserCache");
  await cdpSession.send("Network.clearBrowserCookies");
  log("INFO", "Started clean browser context and cleared cache/cookies before login");

  // Capture API responses + failed requests so a failed step can show whether a
  // backend call (e.g. the login API) was rejected/blocked — distinct from a
  // front-end rendering problem. Static assets are ignored to keep it readable.
  const networkLog: string[] = [];
  const isAsset = (url: string) =>
    /\.(js|css|png|jpe?g|svg|woff2?|ttf|ico|gif|map|json)(\?|$)/i.test(url);
  const isInteresting = (url: string) =>
    /auth|login|otp|signin|verify|mobile|user|sabha|attendance|api/i.test(url);
  page.on("response", (res) => {
    const url = res.url();
    if (isAsset(url)) return;
    const status = res.status();
    if (status >= 400 || isInteresting(url)) {
      networkLog.push(`${status} ${res.request().method()} ${url}`);
    }
  });
  page.on("requestfailed", (req) => {
    if (isAsset(req.url())) return;
    networkLog.push(`FAILED ${req.method()} ${req.url()} — ${req.failure()?.errorText ?? "unknown"}`);
  });

  try {
    // ── Step 1: Login ────────────────────────────────────────────────────────
    await page.goto(websiteUrl, { waitUntil: "domcontentloaded" });
    const alreadyLoggedIn = /\/dashboard|\/new-attendance/.test(page.url());

    if (!alreadyLoggedIn) {
      log("INFO", "Not logged in — starting login flow");

      // Enter phone number
      try {
        await page.locator("input[type='tel']").first().waitFor({ state: "visible", timeout: 30_000 });
      } catch (err) {
        // The login form never rendered — capture what the server actually loaded
        // so we can tell a block page / blank SPA / captcha apart from a slow load.
        await dumpPageState(page, "login-no-phone-field", networkLog);
        throw err;
      }
      const phoneInput = page.locator("input[type='tel']").first();
      await phoneInput.fill(phoneNumber);

      // Verify the number actually landed in the field — a wrong value/format in
      // the server's .env (e.g. with a +91 prefix the field doesn't accept) shows
      // up here as a mismatch and explains a login that never advances.
      const enteredValue = await phoneInput.inputValue().catch(() => "");
      log("INFO", `Phone field value: ${maskPhone(enteredValue)} (env PHONE_NUMBER: ${maskPhone(phoneNumber)})`);
      if (enteredValue.replace(/\D/g, "") !== phoneNumber.replace(/\D/g, "")) {
        log("WARN", "Phone field does NOT match PHONE_NUMBER — check the number/format in .env (the field may expect 10 digits without +91)");
      }

      // Click the CONTINUE button specifically. Using .first() is fragile: the
      // mobile layout renders a nav menu whose buttons (e.g. the menu toggle) can
      // come before the login form, so .first() may click the wrong button and
      // never submit the form.
      const continueBtn = page.getByRole("button", { name: /continue|submit|log\s*in|next/i }).first();
      if (await continueBtn.count()) {
        await continueBtn.click();
      } else {
        const byText = page.locator("button:has-text('CONTINUE'), button:has-text('Continue')").first();
        await (await byText.count() ? byText : page.locator("button").first()).click();
      }
      log("INFO", "Phone submitted, waiting for OTP screen or dashboard");

      // Wait for either OTP screen or direct dashboard (cached session)
      try {
        await Promise.race([
          page.waitForURL(/dashboard/i, { timeout: 45_000 }),
          page.waitForSelector("input.otp-input", { timeout: 45_000 }),
        ]);
      } catch (err) {
        // Neither the OTP screen nor the dashboard appeared after submitting the
        // phone number — likely a rejected number, an error toast, or a block.
        await dumpPageState(page, "login-no-otp-or-dashboard", networkLog);
        throw err;
      }

      const onDashboard = /\/dashboard/.test(page.url());
      if (!onDashboard) {
        log("INFO", "OTP screen detected — filling passcode");
        await fillOtp(page, password);
        try {
          await page.waitForURL(/dashboard/i, { timeout: 45_000 });
        } catch (err) {
          // OTP submitted but never reached the dashboard — wrong passcode or an
          // auth error. Capture the page so we can read any error message shown.
          await dumpPageState(page, "login-otp-rejected", networkLog);
          throw err;
        }
      }

      log("INFO", "Logged in successfully");
    } else {
      log("INFO", "Session already active — skipping login");
    }

    // ── Step 2: Navigate to Sabha attendance list ────────────────────────────
    // Navigate directly by URL — auth token is already in the browser after login,
    // so Angular's route guard will allow it. Must do this AFTER login completes.
    const attendanceUrl = new URL("/new-attendance/sabhas", websiteUrl).toString();
    log("INFO", `Navigating to ${attendanceUrl}`);
    await page.goto(attendanceUrl, { waitUntil: "domcontentloaded" });
    try {
      await page.waitForURL(/new-attendance\/sabhas/i, { timeout: 30_000 });
    } catch (err) {
      // The Sabha-list route never loaded — auth/route-guard redirect, a session
      // that didn't stick, or the SPA failing to render the list.
      await dumpPageState(page, "sabha-list-not-loaded", networkLog);
      throw err;
    }
    await page.waitForTimeout(6_000);

    // ── Step 3: Select the Sabha ─────────────────────────────────────────────
    // Each card on the list shows: [date box] [Sabha name] [stats]
    // We click the element whose text directly says the configured Sabha name
    // and wait for the URL to change, confirming Angular router navigated.
    log("INFO", `Selecting Sabha: ${sabhaName}`);

    const sabhaLocator = page.getByText(sabhaPattern).first();
    try {
      await sabhaLocator.waitFor({ state: "visible", timeout: 15_000 });
    } catch (err) {
      // The configured Sabha name wasn't found in the list — a renamed Sabha,
      // wrong pattern, or a list that loaded empty for this account.
      await dumpPageState(page, "sabha-not-found", networkLog);
      throw err;
    }

    const urlBefore = page.url();
    await sabhaLocator.click();

    // Wait for Angular to navigate away from the Sabha list
    try {
      await page.waitForURL((url) => url.toString() !== urlBefore, { timeout: 15_000 });
    } catch (err) {
      // Clicked the Sabha but the router never navigated to its attendance page.
      await dumpPageState(page, "sabha-click-no-navigation", networkLog);
      throw err;
    }
    await page.waitForTimeout(4_000);

    // ── Step 4: Extract Sabha date ───────────────────────────────────────────
    const bodyText = await page.locator("body").innerText();
    log("INFO", `Page text (first 300 chars): ${bodyText.slice(0, 300).replace(/\n/g, " | ")}`);

    let sabhaDate: Date;
    try {
      sabhaDate = parseSabhaDate(bodyText);
    } catch {
      log("WARN", "Could not parse Sabha date from page — falling back to today's date");
      sabhaDate = new Date();
    }
    log("INFO", `Sabha date: ${sabhaDate.toDateString()}`);

    // ── Step 5: Read bottom-bar counts for verification ──────────────────────
    // The fixed bar always shows: "23 Present  91 Absent  0 Others  114 Total"
    const readBottomCounts = (): Promise<BottomCounts> =>
      page.evaluate(() => {
        const text = document.body.innerText;
        const num = (pattern: RegExp) => {
          const match = text.match(pattern);
          return match ? parseInt(match[1], 10) : null;
        };
        return {
          present: num(/(\d+)\s*Present/i),
          absent: num(/(\d+)\s*Absent/i),
          total: num(/(\d+)\s*Total/i),
        };
      });

    let samparkCounts = requireBottomCounts(await readBottomCounts());
    log(
      "INFO",
      `Sampark count snapshot — Present: ${samparkCounts.present}, ` +
        `Absent: ${samparkCounts.absent}, Total: ${samparkCounts.total}`
    );

    await page.evaluate(() => {
      const blockAttendanceMutation = (event: Event) => {
        const target = event.target as HTMLElement | null;
        const mutationTarget = target?.closest?.("input[type='checkbox'], label, [for]");
        if (!mutationTarget) return;
        event.preventDefault();
        event.stopImmediatePropagation();
      };

      document.addEventListener("click", blockAttendanceMutation, true);
      document.addEventListener("change", blockAttendanceMutation, true);
      document.addEventListener("input", blockAttendanceMutation, true);
    });
    log("INFO", "Installed read-only guard to block attendance checkbox mutations");

    // ── Step 6: DOM diagnostic — understand the actual structure once ──────────
    const domDiag = await page.evaluate(() => {
      const count = (sel: string) => document.querySelectorAll(sel).length;
      const sampleHTML = (sel: string) => {
        const el = document.querySelector(sel);
        return el ? el.outerHTML.slice(0, 400) : null;
      };
      const firstCheckIcon = (() => {
        // Look for any element that visually represents a checkmark
        for (const sel of ["mat-icon", ".material-icons", "[class*='check']", "[class*='tick']", "svg"]) {
          const el = document.querySelector<HTMLElement>(sel);
          if (el) return { sel, tag: el.tagName, cls: el.className.toString(), text: (el.textContent ?? "").trim().slice(0, 30) };
        }
        return null;
      })();
      return {
        counts: {
          li             : count("li"),
          matListItem    : count("mat-list-item"),
          ariaChecked    : count("[aria-checked]"),
          roleCheckbox   : count("[role='checkbox']"),
          inputCheckbox  : count("input[type='checkbox']"),
          matIcon        : count("mat-icon"),
          materialIcons  : count(".material-icons"),
          classCheck     : count("[class*='check']"),
          classRow       : count("[class*='row']"),
          classItem      : count("[class*='item']"),
        },
        firstLiHTML        : sampleHTML("li"),
        firstMatListHTML   : sampleHTML("mat-list-item"),
        firstAriaCheckedHTML: sampleHTML("[aria-checked]"),
        firstCheckIcon,
      };
    });
    // log("INFO", `DOM diagnostic:\n${JSON.stringify(domDiag, null, 2)}`);

    // ── Step 7: Scroll through the list and collect all Yuvak rows ───────────
    // Angular virtual scroll only renders visible rows in the DOM.
    // Strategy: scroll all the way to bottom, pause, collect — repeat until
    // we stop finding new names for MAX_NO_NEW_ROUNDS consecutive passes.
    type Row = ScrapedRow;

    const extractVisible = (): Promise<Row[]> =>
      page.evaluate(() => {
        const normalize = (v: string | null | undefined) =>
          (v || "").replace(/\s+/g, " ").trim();

        const IGNORED = new Set([
          "present", "absent", "attendance", "submit", "send", "back",
          "search", "total", "others", "menu", "home", "contact", "logout",
          "strength", "filter", "sort",
          "present data", "absent data", "name", "absent count",
          "followup name", "mobile", "kk name", "yuvak name",
          "area", "sabha", "attending sabha",
        ]);

        // ── Strategy: [class*='row'] with exactly 1 checkbox = one Yuvak ─────────
        //
        // Diagnostic confirmed:
        //   • The app has 113 input[type='checkbox'] (one per Yuvak + a few extras)
        //   • Row containers use [class*='row'] (120 elements)
        //   • No [aria-checked], no mat-list-item, no mat-icon for attendance
        //
        // Key insight: a container that has EXACTLY 1 checkbox is guaranteed to be
        // a single Yuvak's row. Parent wrappers that span multiple rows have N>1
        // checkboxes. This filter eliminates the large-container name-mismatch bug.
        //
        // Visitor rows: rows with subtitle "Sabha Name | DD/MM/YYYY" are from a
        // different Sabha attending as guests. They are detected early (before the
        // checkbox check) so they are not skipped. If their name is in the current
        // Sabha's roster, they will be marked present; otherwise name-matching ignores them.

        type RowResult = {
          name: string;
          isPresent: boolean;
          htmlSnippet: string;
          subtitle?: string;
        };
        const results: RowResult[] = [];
        const seenNames = new Set<string>();
        const datePattern = /\d{1,2}\/\d{1,2}\/\d{4}/;

        const allRowEls = Array.from(
          document.querySelectorAll<HTMLElement>("[class*='row']")
        );

        for (const row of allRowEls) {
          const rect = row.getBoundingClientRect();
          const style = window.getComputedStyle(row);
          const isVisible =
            style.display !== "none" &&
            style.visibility !== "hidden" &&
            rect.width > 40 &&
            rect.height > 20 &&
            rect.bottom > 70 &&
            rect.top < window.innerHeight - 90;
          if (!isVisible) continue;

          const centerX = Math.min(Math.max(rect.left + rect.width / 2, 1), window.innerWidth - 1);
          const centerY = Math.min(Math.max(rect.top + rect.height / 2, 1), window.innerHeight - 1);
          const topElement = document.elementFromPoint(centerX, centerY);
          if (topElement && !row.contains(topElement) && !topElement.contains(row)) continue;

          const rawInnerText = row.innerText || "";
          const rawText = normalize(rawInnerText);
          if (!rawText || rawText.length < 3) continue;

          const lines = rawInnerText.split(/\n+/).map((l) => normalize(l)).filter(Boolean);

          // Detect visitors BEFORE the checkbox check — visitor rows may have 0
          // checkboxes (read-only display). Visitors are always present by definition.
          const isOtherSabha = lines.some(
            (l) => l.includes(" | ") && /\d{1,2}\/\d{1,2}\/\d{4}/.test(l)
          );

          // For non-visitors: require exactly 1 checkbox (individual Yuvak rows).
          // Parent wrappers that span multiple rows have N>1 checkboxes.
          let isPresent: boolean;
          if (isOtherSabha) {
            isPresent = true; // visitor showed up — always present
          } else {
            const checkboxes = row.querySelectorAll<HTMLInputElement>("input[type='checkbox']");
            if (checkboxes.length !== 1) continue;
            isPresent = checkboxes[0].checked;
          }

          // Extract the Yuvak name.
          // For visitor rows (isOtherSabha) the "custom-label-oneline" CSS causes
          // innerText to concatenate name+SabhaInfo without a newline, so the
          // normal line-based extraction fails. Instead, query leaf child elements
          // whose textContent does NOT contain the " | Date" pattern.
          let nameLine: string;
          let subtitle: string | undefined;
          const subtitleFromLines = lines.find(
            (l) => l.includes(" | ") && datePattern.test(l)
          );
          if (isOtherSabha) {
            const leafTexts = Array.from(row.querySelectorAll<Element>("*"))
              .filter((el) => el.children.length === 0)
              .map((el) => normalize(el.textContent || ""))
              .filter(
                (t) =>
                  t.length > 2 &&
                  /[A-Za-z]{2}/.test(t) &&
                  !/\d{1,2}-[A-Za-z]{3}-\d{4}/.test(t) &&
                  !IGNORED.has(t.toLowerCase())
              );
            // Subtitle: the leaf element carrying "SABHA_NAME | DD/MM/YYYY".
            subtitle = leafTexts.find((t) => t.includes("|") && datePattern.test(t));
            nameLine = leafTexts.find(
              (t) =>
                !t.includes(" | ") &&
                !datePattern.test(t)
            ) ?? "";
          } else {
            subtitle = subtitleFromLines;
            nameLine = lines.find(
              (l) =>
                l.length > 2 &&
                /[A-Za-z]{2}/.test(l) &&
                !l.includes(" | ") &&
                !datePattern.test(l) &&
                !/\d{1,2}-[A-Za-z]{3}-\d{4}/.test(l) &&
                !IGNORED.has(l.toLowerCase())
            ) ?? "";
          }

          if (!nameLine || IGNORED.has(nameLine.toLowerCase())) continue;

          if (!seenNames.has(nameLine)) {
            seenNames.add(nameLine);
            results.push({ name: nameLine, isPresent, htmlSnippet: row.outerHTML.slice(0, 600), subtitle });
          }

          if (!nameLine || IGNORED.has(nameLine.toLowerCase())) continue;

          if (!seenNames.has(nameLine)) {
            seenNames.add(nameLine);
            results.push({ name: nameLine, isPresent, htmlSnippet: row.outerHTML.slice(0, 600) });
          }
        }

        return results;
      });

    // ── Scroll driver ────────────────────────────────────────────────────────
    const collected      = new Map<string, Row>();
    const expectedTotal  = samparkCounts.total;
    const SCROLL_STEP    = 600;          // px per scroll tick
    const MAX_NO_NEW     = 8;            // stop after 8 consecutive rounds with no new names
    const SCROLL_PAUSE   = 600;          // ms to wait for virtual scroll to render
    const MAX_SCAN_PASSES = 3;           // initial scan + two verification rescans

    const extractStableVisible = async (): Promise<Row[]> => {
      const read1 = await extractVisible();
      await page.waitForTimeout(300);
      const read2 = await extractVisible();

      const stable = read1.every((r1) => {
        const r2 = read2.find((r) => r.name === r1.name);
        return !r2 || r1.isPresent === r2.isPresent;
      });

      if (stable) return read2;

      log("WARN", "Visible rows changed while reading; waiting for a stable pass");
      await page.waitForTimeout(400);
      return extractVisible();
    };

    const resetListToTop = async (): Promise<void> => {
      await page.evaluate(() => {
        document.scrollingElement?.scrollTo({ top: 0, behavior: "instant" });
        for (const element of Array.from(document.querySelectorAll<HTMLElement>("*"))) {
          if (element.scrollHeight <= element.clientHeight + 5) continue;
          const overflowY = window.getComputedStyle(element).overflowY;
          if (overflowY === "auto" || overflowY === "scroll") element.scrollTop = 0;
        }
      });
      await page.mouse.move(195, 420);
      await page.mouse.wheel(0, -100_000);
      await page.waitForTimeout(900);
    };

    const runFullScanPass = async (passNumber: number): Promise<void> => {
      await resetListToTop();
      const seenThisPass = new Set<string>();
      let noNewRounds = 0;
      let totalScrolled = 0;

      log(
        "INFO",
        `Attendance scan pass ${passNumber}/${MAX_SCAN_PASSES} started (${expectedTotal} expected)`
      );

      while (noNewRounds < MAX_NO_NEW && seenThisPass.size < expectedTotal) {
        const before = seenThisPass.size;
        const rows = await extractStableVisible();

        for (const row of rows) {
          seenThisPass.add(row.name);
          // Later full passes are more trustworthy than the first observation
          // of a recycled Angular row, so refresh both status and HTML.
          collected.set(row.name, row);
        }

        const gained = seenThisPass.size - before;
        noNewRounds = gained === 0 ? noNewRounds + 1 : 0;
        if (gained > 0) {
          log(
            "INFO",
            `  pass ${passNumber}: +${gained} names ` +
              `(${seenThisPass.size}/${expectedTotal} seen, ${collected.size} unique overall)`
          );
        }

        await page.mouse.wheel(0, SCROLL_STEP);
        totalScrolled += SCROLL_STEP;
        await page.waitForTimeout(SCROLL_PAUSE);

        if (totalScrolled % 5000 === 0) {
          await page.mouse.wheel(0, SCROLL_STEP * 2);
          await page.waitForTimeout(800);
        }
      }

      const finalRows = await extractStableVisible();
      for (const row of finalRows) {
        seenThisPass.add(row.name);
        collected.set(row.name, row);
      }

      log(
        seenThisPass.size === expectedTotal ? "INFO" : "WARN",
        `Attendance scan pass ${passNumber} finished: ` +
          `${seenThisPass.size}/${expectedTotal} names observed in this pass`
      );
    };

    let validation: AttendanceCountValidation | undefined;

    for (let pass = 1; pass <= MAX_SCAN_PASSES; pass++) {
      await runFullScanPass(pass);

      // Refresh counters in case attendance changed while the scan was running.
      samparkCounts = requireBottomCounts(await readBottomCounts());
      const scrapedCounts = rowCounts(Array.from(collected.values()));
      const matched = sameCounts(samparkCounts, scrapedCounts);
      validation = { matched, scanPasses: pass, sampark: samparkCounts, scraped: scrapedCounts };

      log(
        matched ? "INFO" : "WARN",
        `Count validation pass ${pass}: ` +
          `Sampark P=${samparkCounts.present}, A=${samparkCounts.absent}, T=${samparkCounts.total}; ` +
          `scraped P=${scrapedCounts.present}, A=${scrapedCounts.absent}, T=${scrapedCounts.total}; ` +
          `result=${matched ? "MATCH" : "MISMATCH"}`
      );

      if (matched) break;
      if (pass < MAX_SCAN_PASSES) {
        log("WARN", "Count mismatch detected — rescanning the full virtual list before any sheet write");
      }
    }

    if (!validation || !validation.matched) {
      validation = validation ?? {
        matched: false,
        scanPasses: 0,
        sampark: samparkCounts,
        scraped: rowCounts(Array.from(collected.values())),
      };
      await dumpPageState(page, "attendance-count-mismatch", networkLog, "WARN");
      log(
        "WARN",
        `Attendance count mismatch remains after ${validation.scanPasses} full scan passes. ` +
          `Continuing the Sheet sync with the collected rows; the name comparison below ` +
          `will identify people found only in Sampark or only in the Sheet.`
      );
    }

    const allRows = Array.from(collected.values());
    const present = uniqueEntries(allRows.filter((r) =>  r.isPresent));
    const absent  = uniqueEntries(allRows.filter((r) => !r.isPresent));

    log(
      "INFO",
      `${validation.matched ? "Verified" : "Unverified"} attendance read complete — ${present.length} attended, ` +
        `${absent.length} absent, ${allRows.length} total ` +
        `(${validation.scanPasses} scan pass${validation.scanPasses === 1 ? "" : "es"})`
    );
    log("INFO", `Members who attended: ${present.length ? present.map((e) => e.name).join(", ") : "none"}`);
    const subtitleCount = present.filter((e) => e.subtitle).length;
    if (subtitleCount > 0) {
      for (const entry of present.filter((e) => e.subtitle)) {
        log("INFO", `  visited other sabha: ${entry.name} — "${entry.subtitle}"`);
      }
    }

    return {
      sabhaDate,
      rows: allRows,
      present,
      absent,
      samparkCounts,
      countValidation: validation,
    };
  } finally {
    await context.close().catch((error: Error) => {
      log("WARN", `Browser context cleanup failed: ${error.message}`);
    });
    await browser.close().catch((error: Error) => {
      log("WARN", `Browser cleanup failed: ${error.message}`);
    });
  }
}
