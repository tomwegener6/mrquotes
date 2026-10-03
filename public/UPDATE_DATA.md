# How to Update MRQuotes Data

This guide walks you through updating the shared beta data with fresh Salesforce SOQL exports.

## Step-by-Step Process

### 1. Export CSVs from Salesforce SOQL
In Salesforce, run SOQL queries to export the required files:

**Required Files:**
- `RFQ.csv` — All RFQs with vendor names
- `RFQLines.csv` — All RFQ line items with prices and dates
- `Alternates.csv` — All alternate parts relationships
- `Inventory.csv` — Current inventory with part numbers and serial numbers

Save these files to your local MRQuotes project folder: `/mrquotes/data/`

### 2. Start the Local Dev Server
```bash
cd ~/mrquotes
npm run dev
```

The app should be running at `http://localhost:3000`

### 3. Go to the Data Page
Click the **Data** link on the home page (local version only — not available in beta).

### 4. Upload Each CSV File
For each file:
1. Click "Choose File"
2. Select the CSV from your `data/` folder
3. Click "Upload"
4. Confirm the success message shows the correct number of rows

**Order doesn't matter** — upload all 4 files.

### 5. Verify the Data Loaded
- Go to **Analyze Quote** → Enter a quote to verify it finds matches
- Go to **Batch Analysis** → Check that your inventory loads
- Go to **Subcomponents** → Verify part relationships are present

### 6. Commit to Git
Once verified:
```bash
cd ~/mrquotes
git add .
git commit -m "Update data: RFQ, inventory, alternates from Salesforce [YYYY-MM-DD]"
git push origin main
```

### 7. Vercel Auto-Deploys
Vercel watches your GitHub repo and automatically redeploys when you push.

**Check deployment status:**
- Visit: https://vercel.com/dashboard
- Click on "mrquotes" project
- Watch the build progress (usually 30-60 seconds)

### 8. Verify Beta is Updated
Once Vercel finishes:
1. Visit: https://mrquotes-three.vercel.app
2. Log in with password
3. Verify fresh data is live in **Analyze** or **Batch**

---

## Troubleshooting

**"Missing required columns" error:**
- Check that the CSV headers match exactly what the app expects
- Salesforce column names must be: `Name`, `inscor__Vendor__r.Name`, etc.
- Verify you're exporting the right SOQL query

**Data not showing in beta after push:**
- Wait 1-2 minutes for Vercel build to complete
- Refresh the beta URL (hard refresh: Cmd/Ctrl + Shift + R)
- Check Vercel dashboard for build errors

**Want to revert to old data:**
- In GitHub, revert the last commit or restore the previous CSV versions
- Push again
- Vercel redeploys with old data

---

## Quick Reference

| Step | What | Where |
|------|------|-------|
| 1 | Export CSVs from SF SOQL | Salesforce |
| 2 | Save to `/mrquotes/data/` | Local folder |
| 3 | Start local dev | `npm run dev` |
| 4 | Upload via Data page | http://localhost:3000/data |
| 5 | Verify in app | Analyze / Batch / Subcomponents |
| 6 | Commit + push | GitHub |
| 7 | Wait for build | Vercel (1-2 mins) |
| 8 | Test live beta | https://mrquotes-three.vercel.app |

---

**Questions?** Check the local Data page or message Floyd.
