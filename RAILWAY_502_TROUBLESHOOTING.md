# Railway 502 Error - Troubleshooting Checklist

## ✅ Current Configuration Status

Your application is correctly configured with:
- ✅ Dockerfile uses `0.0.0.0:$PORT` 
- ✅ config.php reads Railway environment variables
- ✅ router.php handles requests properly
- ✅ health.php endpoint for monitoring

## 🔍 Step-by-Step Debugging

### Step 1: Check Railway Logs
```bash
railway logs --follow
```

Look for:
- [ ] "Router: Request URI:" messages (confirms PHP is starting)
- [ ] Any error messages or stack traces
- [ ] Database connection errors
- [ ] Port binding confirmation

### Step 2: Verify Environment Variables
In Railway Dashboard → Your Service → Variables:

**Required Variables:**
```
MYSQL_HOST=${{MySQL.MYSQL_HOST}}
MYSQL_USER=${{MySQL.MYSQL_USER}}
MYSQL_PASSWORD=${{MySQL.MYSQL_PASSWORD}}
MYSQL_DATABASE=${{MySQL.MYSQL_DATABASE}}
MYSQL_PORT=${{MySQL.MYSQL_PORT}}
```

**OR if using MYSQL_URL (Railway auto-generates this):**
```
MYSQL_URL=${{MySQL.MYSQL_URL}}
```

**Check:**
- [ ] Variables are set using `${{MySQL.*}}` syntax (not hardcoded)
- [ ] MySQL service is added to your project
- [ ] No conflicting `PORT` variable (Railway sets this automatically)

### Step 3: Check Domain Configuration
Railway Dashboard → Your Service → Settings → Networking:

- [ ] Public domain is generated
- [ ] **Target Port field is EMPTY or not set**
  - If set to 80 or 3000, REMOVE it
  - Railway should auto-detect from $PORT env var
- [ ] Domain status shows "Active"

### Step 4: Test Health Endpoint
Once deployed, test:
```bash
curl https://your-app.railway.app/health.php
```

Expected response:
```json
{
  "status": "healthy",
  "timestamp": "2025-12-14 12:00:00",
  "checks": {
    "database": "connected",
    "uploads": "writable"
  }
}
```

**If health check fails:**
- [ ] Check MySQL service is running (Railway Dashboard)
- [ ] Verify database variables are linked correctly
- [ ] Check logs for connection errors

### Step 5: Verify Build Success
Railway Dashboard → Your Service → Deployments:

- [ ] Latest deployment shows "Success"
- [ ] Build logs show Docker build completed
- [ ] No errors in build process

**Common build issues:**
- Missing Dockerfile
- Syntax errors in Dockerfile
- File permission issues

### Step 6: Check Service Status
Railway Dashboard → Your Service:

- [ ] Service status shows "Active" (green)
- [ ] Not showing "Crashed" or "Failed"
- [ ] No restart loops in deployment history

### Step 7: Database Connection Test
If health.php shows database failed:

**Option A: Use Railway CLI**
```bash
railway connect MySQL
# Then test connection
mysql> SHOW DATABASES;
mysql> USE elearn_db;
mysql> SHOW TABLES;
```

**Option B: Check MySQL Variables**
```bash
railway variables | grep MYSQL
```

### Step 8: Check Metrics
Railway Dashboard → Your Service → Metrics:

- [ ] CPU usage is reasonable (not maxed out)
- [ ] Memory usage is within limits
- [ ] No OOM (Out of Memory) errors
- [ ] Response times are normal

## 🐛 Common Issues and Fixes

### Issue 1: 502 Bad Gateway
**Symptoms:** Browser shows 502 error, no logs from PHP

**Possible Causes:**
1. **Target port is set incorrectly**
   - Fix: Go to Settings → Networking → Remove target port
   
2. **App not binding to 0.0.0.0**
   - Fix: Already correct in your Dockerfile ✅
   
3. **PORT environment variable missing**
   - Fix: Railway sets this automatically, don't override it

4. **Build failed silently**
   - Fix: Check Deployments tab for build errors

### Issue 2: 502 with PHP Logs Present
**Symptoms:** Logs show "Router: Request URI" but still 502

**Possible Causes:**
1. **Database connection failing**
   ```php
   // Check config.php is loading
   error_log("DB_HOST: " . DB_HOST);
   error_log("DB_USER: " . DB_USER);
   ```

2. **MySQL service not running**
   - Fix: Check MySQL service status in Railway dashboard
   - Restart MySQL service if needed

3. **Environment variables not linked**
   - Fix: Use `${{MySQL.*}}` syntax, not hardcoded values

### Issue 3: App Works Locally but Not on Railway
**Possible Causes:**
1. **File paths are absolute (Windows paths)**
   - Fix: Use `__DIR__` for relative paths
   - Already correct in your router.php ✅

2. **Database credentials hardcoded**
   - Fix: Already using getenv() in config.php ✅

3. **Missing database tables**
   - Fix: Import database schema:
   ```bash
   railway connect MySQL
   mysql> source database/elearn_db.sql
   ```

### Issue 4: Intermittent 502 Errors
**Possible Causes:**
1. **App under heavy load**
   - Check Metrics → CPU at 100%?
   - Fix: Upgrade to larger service plan

2. **Database connection pool exhausted**
   - Fix: Ensure connections are properly closed in code

3. **Memory leaks**
   - Fix: Check memory usage in Metrics
   - Restart service as temporary fix

## 🔧 Emergency Fixes

### Quick Fix 1: Restart Service
```bash
railway restart
```

### Quick Fix 2: Redeploy
```bash
git commit --allow-empty -m "Trigger redeploy"
git push origin main
```

### Quick Fix 3: Check Railway Status
Visit: https://status.railway.app
- Railway might be experiencing platform issues

### Quick Fix 4: Enable More Logging
Add to your Dockerfile temporarily:
```dockerfile
# Before CMD line
RUN echo "Build completed at $(date)" > /tmp/build-info.txt

# Update CMD to show more info
CMD echo "Starting PHP server on port $PORT" && \
    php -S 0.0.0.0:${PORT:-80} -t /var/www/html /var/www/html/router.php
```

## 📝 Next Steps if Still Failing

1. **Collect Information:**
   ```bash
   # Save logs
   railway logs > railway-logs.txt
   
   # Save variables
   railway variables > variables.txt
   
   # Save status
   railway status > status.txt
   ```

2. **Test in Development Mode:**
   ```bash
   # Run locally with Railway env vars
   railway run php -S localhost:8080 -t . router.php
   ```

3. **Simplify to Minimum:**
   - Create a simple test.php:
   ```php
   <?php
   echo "PHP works! Port: " . getenv('PORT');
   phpinfo();
   ```
   - Deploy and test this first

4. **Contact Support:**
   - Railway Discord: https://discord.gg/railway
   - Include: logs, variables (redacted), deployment ID

## ✅ Pre-Deployment Checklist

Before deploying, verify:
- [ ] Dockerfile exists and is correct
- [ ] railway.json exists (optional but helpful)
- [ ] config.php uses getenv() for all credentials
- [ ] No hardcoded localhost, 127.0.0.1, or Windows paths
- [ ] database/elearn_db.sql is ready to import
- [ ] MySQL service is added to Railway project
- [ ] Environment variables use ${{MySQL.*}} references
- [ ] Target port is NOT set in domain settings
- [ ] health.php is accessible

## 📊 Success Indicators

Your deployment is successful when:
- ✅ https://your-app.railway.app/health.php returns healthy
- ✅ https://your-app.railway.app/ loads your index page
- ✅ Logs show no errors
- ✅ Database queries work
- ✅ File uploads work (if using Railway volumes)

---

**Remember:** Railway automatically injects the `PORT` environment variable. Your Dockerfile already correctly uses `$PORT`. The most common issue is having a target port override in the domain settings - make sure that's removed!
