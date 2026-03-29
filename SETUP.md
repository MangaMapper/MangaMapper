# Mango's Library – Setup Guide

## Apps Script: Read + Write Integration

This setup hides your Google Sheet ID from the client entirely. All data flows through your Apps Script endpoint — no sheet ID ever appears in your deployed JavaScript.

---

### Step 1 — Open Apps Script

1. Open your Google Sheet
2. Go to **Extensions → Apps Script**

---

### Step 2 — Paste the script

Replace everything in the editor with:

```javascript
const SHEET_NAME = "Mappings";

// GET: return all sheet data as JSON (hides sheet ID from client)
function doGet(e) {
  try {
    const sheet   = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME);
    const values  = sheet.getDataRange().getValues();
    const headers = values[0];
    const rows    = values.slice(1).map(row => {
      const obj = {};
      headers.forEach((h, i) => { obj[h] = row[i] ?? ""; });
      return obj;
    });
    return ContentService
      .createTextOutput(JSON.stringify({ data: rows }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService
      .createTextOutput(JSON.stringify({ error: err.message }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

// POST: append one or many rows
function doPost(e) {
  try {
    const sheet   = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME);
    const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    const parsed  = JSON.parse(e.parameter.data);

    // Accept both a single object and an array of objects
    const entries = Array.isArray(parsed) ? parsed : [parsed];

    entries.forEach(entry => {
      sheet.appendRow(headers.map(h => entry[h] ?? ""));
    });

    return ContentService
      .createTextOutput(JSON.stringify({ success: true, count: entries.length }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService
      .createTextOutput(JSON.stringify({ success: false, error: err.message }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}
```

---

### Step 3 — Deploy as Web App

1. Click **Deploy → New deployment**
2. Click the ⚙️ gear → select **Web app**
3. Set:
   - **Execute as**: Me
   - **Who has access**: Anyone
4. Click **Deploy** → authorize → copy the URL

---

### Step 4 — Update app.js

Open `app.js`, find the `CONFIG` block, and:

1. Set `APPS_SCRIPT_URL` to your URL
2. Clear `SHEET_ID` and `TAB_NAME` (set them to `""`) — they are no longer needed and removing them means the sheet ID never appears in your public JS

```javascript
const CONFIG = {
  APPS_SCRIPT_URL: "https://script.google.com/macros/s/YOUR_ID/exec",
  SHEET_ID: "",   // ← clear this
  TAB_NAME: "",   // ← clear this
  DISCORD_URL: "https://discord.gg/YOUR_INVITE",  // optional
  DISCORD_SUBTEXT: "Discuss mappings, suggest corrections, and chat.",
};
```

---

### Step 5 — Discord (optional)

Set `DISCORD_URL` in `CONFIG` to your Discord invite link to show the join banner on the home page. Leave it as `""` to hide it.

---

### Re-deploying after edits

Always create a **New deployment** (not Manage → edit existing) when you change the script. The URL changes — update `APPS_SCRIPT_URL` in `app.js`.

---

### Mass import format

In the **Add Entry → Mass import** tab, paste tab-separated data in this column order:

```
Franchise · Content format 1 · Volume · Seq# · Chapter Title · Content format 2 · LN Volume · LN Seq# · LN Title · Notes
```

You can copy rows directly from your Google Sheet and paste them. A header row is automatically detected and skipped.

---

### Local dev

```bash
python3 -m http.server 8080
```

Then open `http://localhost:8080`.
