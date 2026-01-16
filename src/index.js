const core = require('@actions/core');
const tc = require('@actions/tool-cache');
const exec = require('@actions/exec');
const os = require('os');
const path = require('path');

const CHANNEL_URLS = {
  stable: 'https://gitpod.io/static/bin',
  latest: 'https://gitpod.io/static/bin/latest'
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
    url: `${baseUrl}/gitpod-cli-${osName}-${archName}${extension}`,
    extension
  };
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

    // Download the CLI binary
    const downloadPath = await tc.downloadTool(url);

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
