# Publishing KF.Jex.VSCode to the Visual Studio Marketplace

## Prerequisites

1. **Azure DevOps Organization** — Required for publisher management.
   - Go to https://dev.azure.com and sign in (or create an org).

2. **Personal Access Token (PAT)** — Used by `vsce` to authenticate.
   - In Azure DevOps, click your avatar → **Personal access tokens**.
   - Click **+ New Token**.
   - Set:
     - **Name**: `vsce-publish` (or similar)
     - **Organization**: `All accessible organizations`
     - **Scopes**: select **Custom defined**, then check **Marketplace → Manage**.
     - **Expiration**: 90 days (or maximum allowed).
   - Copy the token immediately — it won't be shown again.

3. **Publisher Account** — Already set to `koreforger` in `package.json`.
   - Go to https://marketplace.visualstudio.com/manage/createpublisher
   - Create publisher with ID `koreforger` (must match `package.json` publisher field).
   - You may need to verify your identity.

## Setup

```bash
# Install vsce globally (requires Node.js ≥ 18)
npm install -g @vscode/vsce

# Navigate to the extension directory
cd KF.Jex.VSCode

# Log in with your publisher credentials
vsce login koreforger
# Paste the PAT when prompted
```

## Publishing

```bash
# Package the extension (creates a .vsix file)
vsce package

# Publish to the Marketplace
vsce publish
```

Or combine into one step:
```bash
vsce publish --pat <YOUR_PAT>
```

### Version Bumps

```bash
# Bump patch version and publish
vsce publish patch

# Bump minor version and publish
vsce publish minor
```

## CI/CD with GitHub Actions

Create `.github/workflows/publish-vscode.yml`:

```yaml
name: Publish VS Code Extension

on:
  push:
    tags:
      - 'KF.Jex.VSCode/v*'

jobs:
  publish:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: '20'

      - run: npm install -g @vscode/vsce

      - run: npm install

      - name: Publish
        run: vsce publish --pat ${{ secrets.VSCE_PAT }}
```

Set `VSCE_PAT` as a repository secret in GitHub (Settings → Secrets → Actions).

## Verification

After publishing, your extension will appear at:
`https://marketplace.visualstudio.com/items?itemName=koreforger.kf-jex-vscode`

It takes a few minutes for the listing to propagate.

## Notes

- The `package.json` already has the publisher set to `koreforger` and the repository URL pointing to `https://github.com/koreforger/KF.Jex.VSCode`.
- Make sure `README.md`, `CHANGELOG.md`, and the icon file exist before publishing — the marketplace will display them.
- To unpublish: `vsce unpublish koreforger.kf-jex-vscode`
