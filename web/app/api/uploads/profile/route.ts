import fs from "fs";
import path from "path";
import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { loadSkinproPaths } from "@/lib/skinproPaths";
import { safeClientName } from "@/lib/clientAssets";
import { normalizeImageOrientation } from "@/lib/imageProcessing";
import {
  ensureDir,
  guessExtension,
  sanitizeFileName,
  isPathWithin
} from "@/lib/fileUtils";

export const runtime = "nodejs";

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

function renderUploadPage(args: {
  title: string;
  subtitle: string;
  clientId: number;
  error?: string;
}) {
  const { title, subtitle, clientId, error } = args;
  const safeSubtitle = escapeHtml(subtitle);
  const safeTitle = escapeHtml(title);
  const errorBlock = error
    ? `<p style="color:#a62828;margin:0 0 12px;">${escapeHtml(error)}</p>`
    : "";

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>${safeTitle}</title>
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif;
      background-color: #f2f2f2;
      margin: 0;
      padding: 20px 0;
      display: flex;
      justify-content: center;
      align-items: flex-start;
    }
    .container {
      background-color: #fff;
      padding: 25px 20px;
      border-radius: 12px;
      box-shadow: 0 4px 10px rgba(0, 0, 0, 0.08);
      width: 92%;
      max-width: 420px;
      text-align: center;
    }
    h1 {
      font-size: 28px;
      margin: 0 0 6px;
      color: #333;
    }
    .subheading {
      font-size: 16px;
      color: #666;
      margin-bottom: 18px;
    }
    input[type="file"] {
      display: block;
      margin: 0 auto;
      font-size: 16px;
      padding: 12px;
      border-radius: 6px;
      border: 1px solid #ccc;
      background-color: #f9f9f9;
      width: 100%;
      box-sizing: border-box;
    }
    button {
      margin-top: 20px;
      background-color: #6a42c2;
      color: white;
      border: none;
      padding: 14px 20px;
      border-radius: 8px;
      font-size: 16px;
      width: 100%;
      cursor: pointer;
      transition: background-color 0.2s ease-in-out;
    }
    button:hover {
      background-color: #563a9c;
    }
    #spinner {
      display: none;
      margin-top: 20px;
    }
    .loader {
      border: 4px solid #f3f3f3;
      border-top: 4px solid #6a42c2;
      border-radius: 50%;
      width: 32px;
      height: 32px;
      animation: spin 1s linear infinite;
      margin: 0 auto;
    }
    @keyframes spin {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }
    .note {
      font-size: 14px;
      color: #777;
      margin-top: 24px;
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>${safeTitle}</h1>
    <div class="subheading">${safeSubtitle}</div>
    ${errorBlock}
    <form id="uploadForm" method="post" enctype="multipart/form-data" onsubmit="showSpinner()">
      <input type="hidden" name="client_id" value="${clientId}">
      <input type="file" name="photo" accept="image/*">
      <button id="uploadButton" type="submit">Upload</button>
    </form>
    <div id="spinner">
      <div class="loader"></div>
      <p style="font-size: 14px; margin-top: 8px; color: #666;">Uploading...</p>
    </div>
    <div class="note">
      Note: Uploads happen over your private Wi-Fi network.
    </div>
  </div>
  <script>
    function showSpinner() {
      document.getElementById("spinner").style.display = "block";
      var button = document.getElementById("uploadButton");
      button.disabled = true;
      button.innerText = "Uploading...";
    }
  </script>
</body>
</html>`;
}

function renderSuccessPage(args: { subtitle: string }) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Upload Complete</title>
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif;
      background-color: #f2f2f2;
      margin: 0;
      padding: 20px 0;
      display: flex;
      justify-content: center;
      align-items: flex-start;
    }
    .container {
      background-color: #fff;
      padding: 25px 20px;
      border-radius: 12px;
      box-shadow: 0 4px 10px rgba(0, 0, 0, 0.08);
      width: 92%;
      max-width: 420px;
      text-align: center;
    }
    h1 {
      font-size: 28px;
      margin-bottom: 6px;
      color: #333;
    }
    p {
      margin: 0;
      color: #555;
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>Upload Complete</h1>
    <p>${escapeHtml(args.subtitle)}</p>
  </div>
</body>
</html>`;
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const clientId = Number(url.searchParams.get("cid"));

    if (!Number.isFinite(clientId)) {
      return new NextResponse(
        renderUploadPage({
          title: "Upload Profile Picture",
          subtitle: "Missing client information.",
          clientId: clientId || 0,
          error: "Invalid client id."
        }),
        { headers: { "Content-Type": "text/html; charset=utf-8" }, status: 400 }
      );
    }

    const db = getDb();
    const client = db
      .prepare("SELECT full_name FROM clients WHERE id = ?")
      .get(clientId) as { full_name?: string } | undefined;

    if (!client?.full_name) {
      return new NextResponse(
        renderUploadPage({
          title: "Upload Profile Picture",
          subtitle: "Client not found.",
          clientId,
          error: "Client not found."
        }),
        { headers: { "Content-Type": "text/html; charset=utf-8" }, status: 404 }
      );
    }

    return new NextResponse(
      renderUploadPage({
        title: "Upload Profile Picture",
        subtitle: client.full_name,
        clientId
      }),
      { headers: { "Content-Type": "text/html; charset=utf-8" } }
    );
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unexpected error" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const url = new URL(request.url);
    const formData = await request.formData();
    const clientId = Number(formData.get("client_id") ?? url.searchParams.get("cid"));

    if (!Number.isFinite(clientId)) {
      return NextResponse.json({ error: "client_id is required" }, { status: 400 });
    }

    const file = formData.get("photo");
    if (!(file instanceof File)) {
      return new NextResponse(
        renderUploadPage({
          title: "Upload Profile Picture",
          subtitle: "Choose a photo.",
          clientId,
          error: "No file selected."
        }),
        { headers: { "Content-Type": "text/html; charset=utf-8" }, status: 400 }
      );
    }

    const db = getDb();
    const client = db
      .prepare("SELECT full_name, profile_picture FROM clients WHERE id = ?")
      .get(clientId) as
      | { full_name?: string | null; profile_picture?: string | null }
      | undefined;

    if (!client?.full_name) {
      return new NextResponse(
        renderUploadPage({
          title: "Upload Profile Picture",
          subtitle: "Client not found.",
          clientId,
          error: "Client not found."
        }),
        { headers: { "Content-Type": "text/html; charset=utf-8" }, status: 404 }
      );
    }

    const paths = loadSkinproPaths();
    ensureDir(paths.profilePicturesDir);

    const ext = guessExtension(file.name, file.type);
    const safeName = sanitizeFileName(safeClientName(client.full_name));
    const baseName = `${safeName}_id_${clientId}`;
    const targetPath = path.join(paths.profilePicturesDir, `${baseName}${ext}`);

    const buffer = Buffer.from(await file.arrayBuffer());
    const rotated = await normalizeImageOrientation(buffer);
    await fs.promises.writeFile(targetPath, rotated);

    if (
      client.profile_picture &&
      client.profile_picture !== targetPath &&
      isPathWithin(paths.dataDir, client.profile_picture)
    ) {
      if (fs.existsSync(client.profile_picture)) {
        fs.rmSync(client.profile_picture, { force: true });
      }
    }

    db.prepare("UPDATE clients SET profile_picture = ? WHERE id = ?").run(
      targetPath,
      clientId
    );

    return new NextResponse(
      renderSuccessPage({ subtitle: client.full_name }),
      { headers: { "Content-Type": "text/html; charset=utf-8" } }
    );
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unexpected error" },
      { status: 500 }
    );
  }
}
