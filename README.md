# onethreenine.net

The whimsical website for apartment 139 – your communal digital peg board! 📌

[https://onethreenine.net](https://onethreenine.net)

## 🚀 Development

```bash
# Install dependencies
npm install

# Start dev server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

## 📦 Deployment

This site is automatically deployed to GitHub Pages via GitHub Actions whenever you push to the `main` branch.

### Initial GitHub Setup (One-time)

1. **Push this repo to GitHub** (if you haven't already):
   ```bash
   git add .
   git commit -m "Initial commit"
   git remote add origin https://github.com/YOUR_USERNAME/onethreenine.net.git
   git push -u origin main
   ```

2. **Enable GitHub Pages**:
   - Go to your repository on GitHub
   - Navigate to **Settings** → **Pages**
   - Under "Build and deployment":
     - Source: Select **GitHub Actions**
   - Save the settings

3. **The first deployment** will trigger automatically after you push to `main`

### 🌐 DNS Configuration (Squarespace)

To connect your `onethreenine.net` domain from Squarespace to GitHub Pages:

1. **Log into Squarespace** and go to your domain settings

2. **Add DNS Records**:
   - Go to **DNS Settings** for `onethreenine.net`
   
   - **Add A Records** (point to GitHub Pages):
     ```
     Type: A
     Host: @
     Data: 185.199.108.153
     ```
     ```
     Type: A
     Host: @
     Data: 185.199.109.153
     ```
     ```
     Type: A
     Host: @
     Data: 185.199.110.153
     ```
     ```
     Type: A
     Host: @
     Data: 185.199.111.153
     ```
   
   - **Add CNAME Record** (for www subdomain):
     ```
     Type: CNAME
     Host: www
     Data: YOUR_USERNAME.github.io
     ```

3. **Wait for DNS propagation** (can take 24-48 hours, but usually faster)

4. **Enable HTTPS on GitHub**:
   - After DNS propagates, go back to **Settings** → **Pages** on GitHub
   - Check **Enforce HTTPS** ✓
   - GitHub will automatically provision a Let's Encrypt SSL certificate

### 🔍 Verify DNS Setup

Check if DNS is working:
```bash
nslookup onethreenine.net
```

You should see the GitHub Pages IP addresses listed above.

## 🛠️ Tech Stack

- [Astro](https://astro.build) - Static site generator
- GitHub Pages - Hosting
- Squarespace - Domain & DNS management

---

Built with ❤️ for apartment 139
