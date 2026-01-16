const core = require('@actions/core');
const tc = require('@actions/tool-cache');
const exec = require('@actions/exec');
const os = require('os');
const path = require('path');
const https = require('https');

const CHANNEL_URLS = {
  stable: 'https://releases.gitpod.io/cli/stable',
  latest: 'https://releases.gitpod.io/cli/latest'
};

function getDownloadURL(channel) {
  const platform = os.platform();
  const arch = os.arch();

  let osName;
  let archName;
  let extension = '';

  switch (platform) {
    case 'darwin':
      osName = 'darwin';
      break;
    case 'linux':
      osName = 'linux';
      break;
    case 'win32':
      osName = 'windows';
      extension = '.exe';
      break;
    default:
      throw new Error(`Unsupported platform: ${platform}`);
  }

  switch (arch) {
    case 'x64':
      archName = 'amd64';
      break;
    case 'arm64':
      archName = 'arm64';
      break;
    default:
      throw new Error(`Unsupported architecture: ${arch}`);
  }

  const baseUrl = CHANNEL_URLS[channel] || CHANNEL_URLS.stable;

  return {
    url: `${baseUrl}/gitpod-${osName}-${archName}${extension}`,
    extension
  };
}

/**
 * Resolves redirects that may return relative paths (e.g., CloudFront).
 * Returns the final absolute URL after following redirects.
 */
async function resolveRedirect(url, maxRedirects = 5) {
  let currentUrl = url;

  for (let i = 0; i < maxRedirects; i++) {
    const finalUrl = await new Promise((resolve, reject) => {
      const req = https.get(currentUrl, (res) => {
        // Abort the request immediately - we only need headers
        req.destroy();

        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          const location = res.headers.location;
          if (location.startsWith('/')) {
            // Relative redirect - construct absolute URL
            const parsed = new URL(currentUrl);
            resolve(`${parsed.protocol}//${parsed.host}${location}`);
          } else {
            resolve(location);
          }
        } else {
          // No redirect, return null to signal we're done
          resolve(null);
        }
      });
      req.on('error', (err) => {
        // Ignore abort errors
        if (err.code !== 'ECONNRESET') {
          reject(err);
        }
      });
    });

    if (finalUrl === null) {
      return currentUrl;
    }
    currentUrl = finalUrl;
  }

  throw new Error(`Too many redirects (max ${maxRedirects})`);
}

async function run() {
  try {
    const token = core.getInput('token');
    const channel = core.getInput('channel') || 'stable';

    if (!['stable', 'latest'].includes(channel)) {
      throw new Error(`Invalid channel: ${channel}. Must be "stable" or "latest".`);
    }

    const { url, extension } = getDownloadURL(channel);
    core.info(`Using channel: ${channel}`);

    core.info(`Downloading Ona CLI from ${url}`);

    // Resolve redirects that may return relative paths (CloudFront)
    const resolvedUrl = await resolveRedirect(url);
    if (resolvedUrl !== url) {
      core.info(`Resolved to ${resolvedUrl}`);
    }

    // Download the CLI binary
    const downloadPath = await tc.downloadTool(resolvedUrl);

    // Make it executable (not needed on Windows)
    if (os.platform() !== 'win32') {
      await exec.exec('chmod', ['+x', downloadPath]);
    }

    // Create a directory for the tool and move the binary there
    const toolDir = path.join(os.tmpdir(), 'gitpod-cli');
    const fs = require('fs');
    if (!fs.existsSync(toolDir)) {
      fs.mkdirSync(toolDir, { recursive: true });
    }

    const binaryName = os.platform() === 'win32' ? 'gitpod.exe' : 'gitpod';
    const binaryPath = path.join(toolDir, binaryName);
    fs.renameSync(downloadPath, binaryPath);

    // Add to PATH
    core.addPath(toolDir);
    core.info(`Ona CLI installed and added to PATH`);

    // Verify installation
    await exec.exec('gitpod', ['version']);

    // Login if token provided
    if (token) {
      core.info('Authenticating with Ona...');
      await exec.exec('gitpod', ['login', '--token', token]);
      core.info('Successfully authenticated with Ona');
    }

  } catch (error) {
    core.setFailed(error.message);
  }
}

run();
