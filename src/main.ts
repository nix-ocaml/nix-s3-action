import * as core from '@actions/core';
import * as coreCommand from '@actions/core/lib/command'
import * as exec from '@actions/exec';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { URL } from "url";

export const IsPost = !!process.env['STATE_isPost']

// inputs
const endpoint = core.getInput('endpoint', { required: true });
const signingKey = core.getInput('signingKey', { required: true });
const awsAccessKeyId = core.getInput('awsAccessKeyId');
const awsSecretAccessKey = core.getInput('awsSecretAccessKey');
const skipPush = core.getInput('skipPush');
const pathsToPush = core.getInput('pathsToPush');
const pushFilter = core.getInput('pushFilter');
const nixArgs = core.getInput('nixArgs');

const nix_path = path.join(os.homedir(), ".nix");
const key_path = path.join(nix_path, "nix-cache-key.sec");

async function setup() {
  try {
    // for managed signing key and private caches
    if (awsAccessKeyId !== "" && awsSecretAccessKey !== "") {
      const aws_credentials = `[default]
aws_access_key_id = ${awsAccessKeyId}
aws_secret_access_key = ${awsSecretAccessKey}`;

      const aws_path = path.join(os.homedir(), ".aws");
      const aws_credentials_path = path.join(aws_path, "credentials");

      fs.mkdirSync(aws_path, { recursive: true });
      fs.writeFileSync(aws_credentials_path, aws_credentials);
    }

    if (signingKey !== "") {
      fs.mkdirSync(nix_path)
      fs.writeFileSync(key_path, signingKey);
    }
    // Remember existing store paths
    await exec.exec("sh", ["-c", `${__dirname}/list-nix-store.sh > /tmp/store-path-pre-build`]);
  } catch (error) {
    core.setFailed(`Action failed with error: ${error}`);
  }
}

async function upload() {
  core.startGroup('S3 cache: push');
  try {
    if (skipPush === 'true') {
      core.info('Pushing is disabled as skipPush is set to true');
    } else if (signingKey !== "" && awsAccessKeyId !== "" && awsSecretAccessKey !== "") {
      const cache_url = new URL(endpoint);
      cache_url.searchParams.append("compression", "zstd");
      cache_url.searchParams.append("parallel-compression", "true");
      cache_url.searchParams.append("secret-key",  key_path);

      const cache_target = decodeURIComponent(cache_url.toString());
      console.log(cache_target);

      await exec.exec(`${__dirname}/push-paths.sh`, [nixArgs, cache_target, pathsToPush, pushFilter]);
    } else {
      core.info('Pushing is disabled as signingKey, awsAccessKeyId or awsSecretAccessKey is not set (or are empty?) in your YAML file.');
    }
  } catch (error) {
    core.setFailed(`Action failed with error: ${error}`);
  }
  core.endGroup();
}

// Main
if (!IsPost) {
  // Publish a variable so that when the POST action runs, it can determine it should run the cleanup logic.
  // This is necessary since we don't have a separate entry point.
  coreCommand.issueCommand('save-state', {name: 'isPost'}, 'true')
  setup()
} else {
  // Post
  upload()
}
