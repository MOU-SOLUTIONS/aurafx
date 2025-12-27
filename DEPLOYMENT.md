# AuraFX Deployment Guide - Vercel

## Quick Setup

### 1. Vercel Configuration

When importing your project in Vercel, use these settings:

- **Framework Preset:** Angular
- **Root Directory:** `AuraFX` (if your repo has the project in a subdirectory)
- **Build Command:** `npm run build` (default)
- **Output Directory:** `dist/AuraFX/browser` (automatically configured via vercel.json)
- **Install Command:** `npm install` (default)

### 2. Environment Variables

No environment variables are required for this project as it uses the public Frankfurter API.

### 3. Build Configuration

The project is configured with:
- ✅ `vercel.json` - Vercel-specific configuration
- ✅ Production build configuration in `angular.json`
- ✅ Proper output path configuration
- ✅ SPA routing rewrites for Angular routes
- ✅ Asset caching headers

### 4. Deployment Steps

1. **Connect Repository:**
   - Go to Vercel Dashboard
   - Click "New Project"
   - Import from GitHub: `MOU-SOLUTIONS/aurafx`
   - Select branch: `main`

2. **Configure Project:**
   - Framework Preset: **Angular**
   - Root Directory: **AuraFX** (if your project is in a subdirectory)
   - Project Name: `aurafx` (or your preferred name)
   - Build Command: `npm run build` (should auto-detect)
   - Output Directory: `dist/AuraFX/browser` (configured in vercel.json)

3. **Deploy:**
   - Click "Deploy"
   - Wait for build to complete
   - Your app will be live at `https://your-project.vercel.app`

### 5. Troubleshooting

#### Build Fails with "Cannot find module"
- **Solution:** Make sure `node_modules` is not in `.gitignore` incorrectly
- Check that all dependencies are in `package.json`

#### Build Succeeds but 404 on Routes
- **Solution:** The `vercel.json` includes rewrites for SPA routing
- Verify the rewrites section is present

#### Build Output Not Found
- **Solution:** Check that `outputDirectory` in `vercel.json` matches Angular build output
- Default Angular 17+ output: `dist/AuraFX/browser`
- Verify in `angular.json` that `outputPath` is set to `dist/AuraFX`

#### Build Timeout
- **Solution:** Vercel has build time limits
- Hobby plan: 45 minutes
- Pro plan: 60 minutes
- If timeout occurs, optimize build or upgrade plan

### 6. Post-Deployment

After successful deployment:

1. **Verify Routes:**
   - Test all routes: `/`, `/converter`, `/rates`, `/charts`
   - Ensure client-side routing works

2. **Check API Calls:**
   - Verify Frankfurter API calls work
   - Check browser console for errors

3. **Test Features:**
   - Currency conversion
   - Chart rendering
   - Theme switching
   - Language switching

### 7. Custom Domain (Optional)

1. Go to Project Settings → Domains
2. Add your custom domain
3. Follow DNS configuration instructions
4. Wait for DNS propagation

### 8. Environment-Specific Builds

If you need different configurations for different environments:

1. Create environment files:
   - `src/environments/environment.prod.ts`
   - `src/environments/environment.ts`

2. Update `angular.json` to use file replacements:
```json
"fileReplacements": [
  {
    "replace": "src/environments/environment.ts",
    "with": "src/environments/environment.prod.ts"
  }
]
```

### 9. Build Optimization

The project is already optimized with:
- ✅ Production build configuration
- ✅ Tree shaking enabled
- ✅ Minification enabled
- ✅ Asset optimization
- ✅ Code splitting (lazy loading)

### 10. Monitoring

Monitor your deployment:
- **Vercel Dashboard:** View build logs and analytics
- **Real-time Logs:** Check function logs
- **Analytics:** Enable Vercel Analytics for user insights

---

## File Structure for Deployment

```
AuraFX/
├── vercel.json          ← Vercel configuration
├── angular.json         ← Angular build config (updated)
├── package.json         ← Dependencies (updated build script)
├── src/                 ← Source code
├── public/              ← Public assets
└── dist/                ← Build output (generated, gitignored)
    └── AuraFX/
        └── browser/     ← Actual deployment output
```

---

## Common Issues & Solutions

### Issue: "Build command failed"
**Solution:** 
- Check Node.js version (should be 18.x or 20.x)
- Verify all dependencies install correctly
- Check build logs for specific errors

### Issue: "Output directory not found"
**Solution:**
- Verify `outputPath` in `angular.json` is `dist/AuraFX`
- Check that build actually completes
- Verify `vercel.json` has correct `outputDirectory`

### Issue: "Routes return 404"
**Solution:**
- Verify `vercel.json` has rewrites section
- Ensure all routes redirect to `/index.html`
- Test with direct URL access

### Issue: "API calls fail"
**Solution:**
- Check CORS settings (Frankfurter API should allow all)
- Verify API endpoint URLs
- Check browser console for errors
- Test API directly in browser

---

## Support

If you encounter issues:
1. Check Vercel build logs
2. Review browser console errors
3. Verify all configuration files are correct
4. Check Angular build locally: `npm run build`

---

**Last Updated:** 2024-12-26

