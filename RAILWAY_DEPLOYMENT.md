# EyeLearn Railway Deployment Guide

## Quick Railway Deployment

### Prerequisites
1. Railway account (railway.app)
2. MySQL database service on Railway
3. Git repository

### Step 1: Create New Project
```bash
# Install Railway CLI (optional)
npm i -g @railway/cli

# Login to Railway
railway login
```

### Step 2: Deploy from GitHub
1. Go to railway.app/new
2. Select "Deploy from GitHub repo"
3. Choose your EyeLearn repository
4. Railway will auto-detect the Dockerfile

### Step 3: Add MySQL Database
1. In your project, click "+ New"
2. Select "Database" → "MySQL"
3. Railway will provision a MySQL database

### Step 4: Configure Environment Variables
Add these variables in Railway's dashboard under "Variables":

```
DB_HOST=${{MySQL.MYSQL_HOST}}
DB_USER=${{MySQL.MYSQL_USER}}
DB_PASS=${{MySQL.MYSQL_PASSWORD}}
DB_NAME=${{MySQL.MYSQL_DATABASE}}
DB_PORT=${{MySQL.MYSQL_PORT}}
```

### Step 5: Import Database Schema
1. Connect to MySQL using Railway's connection string
2. Import your database:
```bash
mysql -h $DB_HOST -u $DB_USER -p$DB_PASS $DB_NAME < database/elearn_db.sql
```

Or use Railway CLI:
```bash
railway connect MySQL
# Then run: source database/elearn_db.sql
```

### Step 6: Set Public Domain
1. Go to Settings → Networking
2. Click "Generate Domain" or add custom domain
3. **Important**: Verify the target port is not set (let it auto-detect from PORT env var)

## Troubleshooting 502 Errors

### Check 1: Verify Port Configuration
Your Dockerfile already correctly uses:
```dockerfile
CMD php -S 0.0.0.0:${PORT:-80} -t /var/www/html /var/www/html/router.php
```

Railway injects `$PORT` automatically - do NOT override it in environment variables.

### Check 2: Health Check
Test your deployment:
```
https://your-app.railway.app/health.php
```

Should return:
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

### Check 3: View Logs
```bash
railway logs
```

Look for:
- "Router: Request URI:" messages
- Any PHP errors
- Database connection issues

### Check 4: Domain Target Port
In Railway Dashboard:
1. Go to your service → Settings → Networking
2. Find your public domain
3. **Leave "Target Port" empty or ensure it's not set to a specific value**
4. Railway will use the PORT environment variable automatically

### Check 5: Database Connection
Verify environment variables are properly set:
```bash
railway variables
```

Ensure they reference the MySQL service variables:
- `DB_HOST=${{MySQL.MYSQL_HOST}}`
- Not hardcoded IP addresses

## Common Issues

### Issue: 502 Bad Gateway
**Cause**: Target port mismatch or app not listening
**Solution**: 
- Remove any target port override in domain settings
- Verify Dockerfile CMD uses `$PORT` (✓ already correct)

### Issue: Database connection failed
**Cause**: Environment variables not set or incorrect
**Solution**:
- Link MySQL service variables properly
- Check MySQL service is running
- Verify config.php reads from environment:
```php
define('DB_HOST', getenv('DB_HOST') ?: 'localhost');
```

### Issue: File uploads fail
**Cause**: Filesystem is ephemeral on Railway
**Solution**:
- Use Railway's volume mounts, or
- Use cloud storage (S3, Cloudinary) for uploads

## Monitoring

### Health Checks
Railway automatically monitors `/health.php`

### View Metrics
```bash
railway status
```

### View Real-time Logs
```bash
railway logs --follow
```

## Scaling

### Vertical Scaling
- Go to Settings → Resources
- Increase CPU/Memory allocation

### Horizontal Scaling
- Go to Settings → Scaling
- Add replicas (Pro plan required)

## Support Resources
- Railway Docs: docs.railway.app
- Community: discord.gg/railway
- Status: status.railway.app

## Quick Commands Reference
```bash
# Deploy current branch
railway up

# View logs
railway logs

# Open service in browser
railway open

# Connect to MySQL
railway connect MySQL

# View environment variables
railway variables

# Link to existing project
railway link
```
