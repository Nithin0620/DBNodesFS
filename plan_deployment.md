# DBNodesFS — End-to-End Deployment Plan (GitHub Actions + Cloudflare Pages)

This document details the complete deployment architecture and automated CI/CD pipeline using **GitHub Actions** and **Cloudflare Pages**.

---

## 1. Architecture Overview

```mermaid
flowchart TD
    Dev["Developer"] -->|git push origin main| GitHub["GitHub Repository\n(Nithin0620/DBNodesFS)"]

    subgraph CI_CD ["Fully Automated CI/CD (Zero Server Cost)"]
        GitHub -->|Webhook| CF["Cloudflare Pages\n(Auto-builds & hosts frontend SPA)"]
        GitHub -->|GitHub Actions Workflow| GHA["GitHub Actions Runner\n(.github/workflows/deploy.yml)"]
    end

    GHA -->|SSH Deploy via Secret OCI_SSH_KEY| OCI["OCI Server (80.225.207.232)\n12GB RAM ARM64"]

    subgraph OCI Backend Cluster
        Coord["Coordinator (:4000)"]
        Worker["BullMQ Worker"]
        Embedder["Python Embedder (:8000)"]
        N1["Storage Node 1 (:5001)"]
        N2["Storage Node 2 (:5002)"]
        N3["Storage Node 3 (:5003)"]
        Mongo[("MongoDB 7")]
        Redis[("Redis 7")]
        Qdrant[("Qdrant Vector DB")]
    end

    OCI --- Coord
    Coord --> Mongo & Redis & N1 & N2 & N3
    Worker --> Redis & Embedder & Qdrant

    User["End User / Browser"] -->|HTTPS| CF
    CF -->|API Requests: https://api.dbnodesfs.ssh.net.in| Coord
```

### Why this architecture is vastly superior:
1. **Zero Jenkins overhead**: No JVM memory hogs, no 1GB VM disk thrashing/freezing.
2. **100% Free Managed CI/CD**: GitHub Actions provides 2,000 free runner minutes/month.
3. **Dual Trigger on Git Push**:
   - Cloudflare Pages builds and deploys the static Vite frontend.
   - GitHub Actions connects over SSH to OCI and runs `docker compose up -d --build --scale web=0`.

---

## 2. One-Time Setup Steps

### Step 1: Generate an SSH Key Pair for GitHub Actions
On your local computer (or terminal), generate a dedicated SSH key pair:
```bash
ssh-keygen -t ed25519 -C "github-actions-dbnodesfs" -f /tmp/gha_oci_key -N ""
```
This generates two files:
- `/tmp/gha_oci_key` (Private key)
- `/tmp/gha_oci_key.pub` (Public key)

### Step 2: Add the Public Key to your OCI Server
Log into your **OCI server** (`80.225.207.232`) and paste the contents of `/tmp/gha_oci_key.pub` into `~/.ssh/authorized_keys`:
```bash
cat << 'EOF' >> ~/.ssh/authorized_keys
<PASTE_CONTENTS_OF_gha_oci_key.pub_HERE>
EOF

chmod 700 ~/.ssh
chmod 600 ~/.ssh/authorized_keys
```

### Step 3: Add the Private Key to GitHub Secrets
1. Go to your GitHub repository: **`https://github.com/Nithin0620/DBNodesFS`**
2. Click **Settings** -> **Secrets and variables** -> **Actions**.
3. Click **New repository secret**:
   - **Name**: `OCI_SSH_KEY`
   - **Secret**: Copy and paste the entire contents of `/tmp/gha_oci_key` (including `-----BEGIN OPENSSH PRIVATE KEY-----` and `-----END OPENSSH PRIVATE KEY-----`).
4. Click **Add secret**.
*(You can now safely delete `/tmp/gha_oci_key` and `/tmp/gha_oci_key.pub` from your temporary folder).*

---

## 3. GitHub Actions Workflow Configuration

The workflow is stored in [.github/workflows/deploy.yml](file:///home/nithin/Projects/DBNodesFS/.github/workflows/deploy.yml):

```yaml
name: Deploy Backend to OCI

on:
  push:
    branches: [ main ]
  workflow_dispatch:

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - name: Deploy via SSH to OCI
        uses: appleboy/ssh-action@v1.0.3
        with:
          host: 80.225.207.232
          username: ubuntu
          key: ${{ secrets.OCI_SSH_KEY }}
          script: |
            set -e
            if [ ! -d ~/dbnodesfs ]; then
              git clone https://github.com/Nithin0620/DBNodesFS.git ~/dbnodesfs
            fi
            cd ~/dbnodesfs
            git fetch --all
            git reset --hard origin/main
            docker compose up -d --build --scale web=0 --remove-orphans
```

---

## 4. Cloudflare Pages Configuration (Frontend)

In your Cloudflare Pages dashboard:
- **Build command**: `pnpm --filter @dbnodesfs/shared build && pnpm --filter @dbnodesfs/web build`
- **Build output directory**: `apps/web/dist`
- **Root directory**: `/`
- **Environment variables**:
  - `NODE_VERSION`: `22`
  - `VITE_API_URL`: `https://api.dbnodesfs.ssh.net.in`

---

## 5. One-Command Teardown & Full Wipe

To completely stop and wipe all DBNodesFS containers and data volumes from your OCI server at any time:

```bash
docker compose down -v --remove-orphans
```
*(Wipes MongoDB, Redis, Qdrant vectors, and chunk data from `node1-data`, `node2-data`, `node3-data` without impacting any other databases or services).*
