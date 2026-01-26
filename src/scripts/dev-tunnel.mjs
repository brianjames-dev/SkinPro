import { spawn } from "child_process";

const tunnelRegex = /https:\/\/[a-z0-9.-]+\.trycloudflare\.com/;
let devStarted = false;
let devProcess = null;
let tunnelUrl = null;

const startDevServer = (url) => {
  if (devStarted) {
    return;
  }
  devStarted = true;
  tunnelUrl = url;
  console.log(`[tunnel] URL: ${url}`);
  console.log("[tunnel] Starting Next dev server with SKINPRO_QR_HOST...");
  const env = { ...process.env, SKINPRO_QR_HOST: url };
  const npmExecPath = process.env.npm_execpath;
  if (npmExecPath) {
    devProcess = spawn(process.execPath, [npmExecPath, "run", "dev:local"], {
      env,
      stdio: "inherit"
    });
  } else {
    const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";
    devProcess = spawn(npmCommand, ["run", "dev:local"], {
      env,
      stdio: "inherit",
      shell: process.platform === "win32"
    });
  }
};

const cloudflared = spawn(
  "cloudflared",
  ["tunnel", "--url", "http://127.0.0.1:3000"],
  { stdio: ["ignore", "pipe", "pipe"] }
);

const shutdown = () => {
  if (devProcess) {
    devProcess.kill("SIGINT");
  }
  cloudflared.kill("SIGINT");
};

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

const handleTunnelOutput = (chunk, stream) => {
  const text = chunk.toString();
  const match = text.match(tunnelRegex);
  if (match && match[0]) {
    startDevServer(match[0]);
  }
  stream.write(chunk);
};

cloudflared.stdout.on("data", (chunk) => {
  handleTunnelOutput(chunk, process.stdout);
});

cloudflared.stderr.on("data", (chunk) => {
  handleTunnelOutput(chunk, process.stderr);
});

cloudflared.on("close", (code) => {
  if (!devStarted) {
    console.error(`[tunnel] cloudflared exited with code ${code}`);
  }
});
