# Railway Deployment Guide - Ship APE Core SSE

## 🚀 Quick Deploy Options

### Option 1: Railway Web Dashboard (Easiest)

1. **Visit [railway.app](https://railway.app)** and create account
2. **Create New Project** → "Deploy from GitHub repo"
3. **Connect Repository**: `shape-core-sse`
4. **Configure Environment Variables**:
   ```
   NODE_ENV=production
   SHAPE_SSE_MODE=true
   SHIP_APE_MASTER_KEY=your-secure-production-key-here
   ```
5. **Deploy** - Railway will auto-build and deploy

### Option 2: Railway CLI

```bash
# Login (opens browser)
railway login

# Initialize project in current directory
railway init

# Set environment variables
railway variables set NODE_ENV=production
railway variables set SHAPE_SSE_MODE=true
railway variables set SHIP_APE_MASTER_KEY=your-secure-key

# Deploy
railway up
```

### Option 3: GitHub Actions Auto-Deploy

1. **Set GitHub Secrets** in your repo settings:
   - `RAILWAY_TOKEN` - Get from Railway dashboard → Account → Tokens
   - `RAILWAY_SERVICE_ID` - Get from Railway project URL
   - `SHIP_APE_MASTER_KEY` - Your secure production key

2. **Push to main branch** - GitHub Actions will auto-deploy

## 🔧 Configuration Files

- ✅ `railway.toml` - Railway service configuration
- ✅ `nixpacks.toml` - Build/runtime configuration  
- ✅ `.github/workflows/railway-deploy.yml` - CI/CD pipeline

## 🌐 After Deployment

Your Ship APE Core SSE server will be available at:
```
https://your-app-name.railway.app
```

### Health Check
```bash
curl https://your-app-name.railway.app/health
```

### Connect to Claude Code
```bash
claude mcp add --transport http ship-ape-core-remote https://your-app-name.railway.app/mcp --header "Authorization: Bearer your-api-key"
```

## 🔐 Security Notes

- ⚠️ **Change the master key** from default `test-key-123`
- 🔒 Use strong, unique API keys for production
- 🛡️ Railway provides HTTPS by default
- 🔑 Store secrets in Railway environment variables

## 📊 Expected Resources

- **Memory**: ~512MB
- **CPU**: Minimal (1x shared)
- **Storage**: Ephemeral (SQLite in-memory/temp files)
- **Network**: HTTP/HTTPS on Railway-assigned port

## 🎯 Production Checklist

- [ ] Set strong `SHIP_APE_MASTER_KEY`
- [ ] Configure proper CORS origins
- [ ] Set up monitoring/logging
- [ ] Test all 25 Ship APE tools
- [ ] Verify Claude Code integration
- [ ] Document tenant API keys

**Railway deployment ready! 🚀**