# EyeLearn Deployment Checklist

## Before Deployment
- [ ] Export database: `mysqldump -u root -p elearn_db > elearn_db.sql`
- [ ] Update database credentials in `config.php`
- [ ] Run `check_database.php` to verify connectivity
- [ ] Test all functionality locally
- [ ] Backup current files
- [ ] Check file permissions (755 for directories, 644 for files)
- [ ] Remove debug files and test data
- [ ] Verify eye tracking Python service requirements

## Database Configuration
- [ ] Verify `config.php` has correct credentials
- [ ] All database files use `require_once 'config.php'`
- [ ] All connections use `getDBConnection()` or `getPDOConnection()`
- [ ] No hardcoded database credentials in other files

## Security Hardening
- [ ] Change default admin password
- [ ] Update database passwords in `config.php`
- [ ] Remove phpMyAdmin from production
- [ ] Enable HTTPS/SSL
- [ ] Configure firewall rules
- [ ] Set up regular backups
- [ ] Hide PHP version headers
- [ ] Disable directory browsing

## Performance Optimization
- [ ] Enable PHP OPcache
- [ ] Configure Apache compression (gzip)
- [ ] Optimize database queries
- [ ] Set up CDN for static assets
- [ ] Configure proper caching headers
- [ ] Minify CSS/JavaScript files

## Monitoring Setup
- [ ] Set up error logging
- [ ] Configure uptime monitoring
- [ ] Set up database monitoring
- [ ] Configure backup alerts
- [ ] Monitor disk space usage

## Post-Deployment Testing
- [ ] Test login functionality
- [ ] Verify eye tracking works
- [ ] Check admin dashboard
- [ ] Test student management
- [ ] Validate real-time data updates
- [ ] Test on different devices/browsers
- [ ] Run `check_database.php` on production
