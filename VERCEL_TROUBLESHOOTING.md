# Vercel 404 Error - Troubleshooting Guide

## Problem
Getting 404 NOT_FOUND error after successful deployment.

## Root Cause Analysis

Your project structure is:
```
Repository Root/
  └── AuraFX/          ← Your Angular project is HERE
      ├── src/
      ├── angular.json
      ├── vercel.json
      └── dist/        ← Build output goes here
          └── AuraFX/
              └── browser/  ← Actual deployment files
```

## Solution 1: Fix Root Directory in Vercel (RECOMMENDED)

1. Go to your Vercel project dashboard
2. Click on **Settings** → **General**
3. Scroll to **Root Directory**
4. Change from `./` to `AuraFX`
5. Save changes
6. Redeploy

**Why this works:**
- Vercel needs to know where your `package.json` and `angular.json` are
- If Root Directory is `./`, Vercel looks at the repo root (which doesn't have these files)
- Setting it to `AuraFX` tells Vercel where your project actually is

## Solution 2: Verify Output Directory

After setting Root Directory to `AuraFX`, verify:

1. **Build Command:** `npm run build` (should work from AuraFX directory)
2. **Output Directory:** `dist/AuraFX/browser` (relative to Root Directory)
3. **Framework:** Angular (should auto-detect)

## Solution 3: Check Build Logs

In Vercel deployment logs, look for:
```
✔ Building...
Initial chunk files | Names | Raw size
```

Then verify:
```
Output Directory: dist/AuraFX/browser
```

If you see a different path, update `vercel.json` accordingly.

## Solution 4: Test Locally First

Before deploying, test the build locally:

```bash
cd AuraFX
npm install
npm run build
```

Then check if `dist/AuraFX/browser/index.html` exists:
```bash
ls dist/AuraFX/browser/index.html
```

If this file exists locally, the build is correct.

## Solution 5: Alternative vercel.json (If Root Directory is ./)

If you MUST keep Root Directory as `./`, update vercel.json:

```json
{
  "version": 2,
  "buildCommand": "cd AuraFX && npm run build",
  "outputDirectory": "AuraFX/dist/AuraFX/browser",
  "rewrites": [
    {
      "source": "/(.*)",
      "destination": "/index.html"
    }
  ]
}
```

**But Solution 1 is much better!**

## Verification Checklist

After fixing, verify:

- [ ] Root Directory in Vercel is set to `AuraFX`
- [ ] Build completes successfully in Vercel logs
- [ ] Output Directory shows correct path in build logs
- [ ] `index.html` exists in the output directory
- [ ] Rewrites are configured in vercel.json
- [ ] Root URL (`https://your-project.vercel.app/`) loads
- [ ] Routes like `/converter`, `/rates` work
- [ ] Direct navigation to routes works (no 404)

## Common Mistakes

1. **Root Directory = `./`** when project is in subdirectory
   - ❌ Wrong: Vercel can't find package.json
   - ✅ Right: Set to `AuraFX`

2. **Output Directory mismatch**
   - ❌ Wrong: `dist/browser` (Angular 17+ structure)
   - ✅ Right: `dist/AuraFX/browser` (your project structure)

3. **Missing rewrites**
   - ❌ Wrong: No rewrites = 404 on all routes
   - ✅ Right: Rewrite all routes to `/index.html`

4. **Build fails but deployment shows "success"**
   - Check build logs carefully
   - Look for errors or warnings

## Still Not Working?

1. **Check Vercel Build Logs:**
   - Look for "Output Directory" in logs
   - Verify files are being created

2. **Verify File Structure:**
   - Build locally: `npm run build`
   - Check: `dist/AuraFX/browser/index.html` exists
   - Compare with Vercel output

3. **Test Rewrites:**
   - Visit: `https://your-project.vercel.app/`
   - Should load (not 404)
   - Visit: `https://your-project.vercel.app/converter`
   - Should load (not 404)

4. **Clear Vercel Cache:**
   - Settings → General → Clear Build Cache
   - Redeploy

5. **Check Base Href:**
   - In `angular.json`, verify `baseHref` is not set incorrectly
   - Should be `/` for root deployment

## Quick Fix Command

If you want to verify locally before deploying:

```bash
cd AuraFX
npm run build
# Check output
ls -la dist/AuraFX/browser/index.html
# Should show the file exists
```

If this works locally, the issue is definitely the Root Directory setting in Vercel.

---

**Most Likely Fix:** Set Root Directory to `AuraFX` in Vercel project settings.

