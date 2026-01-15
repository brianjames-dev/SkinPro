import fs from "fs";
import path from "path";
import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { loadSkinproPaths } from "@/lib/skinproPaths";
import { safeClientName } from "@/lib/clientAssets";
import { normalizeImageOrientation } from "@/lib/imageProcessing";
import { getUploadToken, markUploadTokenUsed } from "@/lib/qrTokens";
import { PROFILE_UPLOAD_LIMITS, validateImageFiles } from "@/lib/uploadValidation";
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
  token?: string;
  error?: string;
  showForm?: boolean;
}) {
  const { title, subtitle, token, error, showForm = true } = args;
  const safeSubtitle = escapeHtml(subtitle);
  const safeTitle = escapeHtml(title);
  const safeToken = token ? escapeHtml(token) : "";
  const tokenInput = token
    ? `<input type="hidden" name="token" value="${safeToken}">`
    : "";
  const errorBlock = error
    ? `<p style="color:#a62828;margin:0 0 12px;">${escapeHtml(error)}</p>`
    : "";
  const formBlock = showForm
    ? `<form id="uploadForm" method="post" enctype="multipart/form-data" onsubmit="showSpinner()">
      ${tokenInput}
      <div class="pickerButtons">
        <button type="button" class="pickerButton" onclick="openLibrary()">Photo Library</button>
        <button type="button" class="pickerButton" onclick="openCamera()">Take Photo</button>
      </div>
      <div id="previewGrid" class="previewGrid hidden"></div>
      <input id="libraryInput" class="hiddenInput" type="file" name="photo" accept="image/*">
      <input id="cameraInput" class="hiddenInput" type="file" name="photo" accept="image/*" capture="environment">
      <button id="uploadButton" type="submit">Upload</button>
    </form>
    <div id="spinner">
      <div class="loader"></div>
      <p style="font-size: 14px; margin-top: 8px; color: #666;">Uploading...</p>
    </div>`
    : "";

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>${safeTitle}</title>
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body {
      font-family: "Avenir Next", "Nunito", "Helvetica Neue", Arial, sans-serif;
      background: linear-gradient(180deg, #fbf6ee 0%, #f6efe5 100%);
      margin: 0;
      padding: 20px 0;
      display: flex;
      justify-content: center;
      align-items: flex-start;
      color: #2a241f;
    }
    .container {
      background-color: #fffdfa;
      padding: 28px 24px;
      border-radius: 18px;
      border: 1px solid #ead8c3;
      box-shadow: 0 10px 24px rgba(43, 34, 23, 0.08);
      width: 92%;
      max-width: 460px;
      text-align: center;
    }
    .eyebrow {
      text-transform: uppercase;
      letter-spacing: 0.2em;
      font-size: 11px;
      color: #7a6a58;
      margin-bottom: 10px;
    }
    h1 {
      font-size: 26px;
      margin: 0 0 6px;
      color: #241f1a;
    }
    .subheading {
      font-size: 15px;
      color: #6f5f4e;
      margin-bottom: 20px;
    }
    input[type="file"] {
      display: block;
      margin: 0 auto;
      font-size: 15px;
      padding: 12px 14px;
      border-radius: 12px;
      border: 1px solid #e3d2bf;
      background-color: #fff;
      width: 100%;
      box-sizing: border-box;
      color: #2a241f;
    }
    .hiddenInput {
      position: absolute;
      left: -9999px;
      width: 1px;
      height: 1px;
      opacity: 0;
    }
    .pickerButtons {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 10px;
      margin-top: 8px;
    }
    .pickerButton {
      margin-top: 0;
      background-color: #fff;
      color: #2a241f;
      border: 1px solid #e3d2bf;
      border-radius: 12px;
      font-size: 14px;
      font-weight: 600;
      padding: 12px 14px;
      width: 100%;
    }
    .pickerButton:hover {
      background-color: #f3eadf;
      transform: translateY(-1px);
    }
    .previewGrid {
      margin-top: 14px;
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 10px;
    }
    .previewImage {
      width: 100%;
      aspect-ratio: 1 / 1;
      object-fit: cover;
      border-radius: 12px;
      border: 1px solid #ead8c3;
    }
    .hidden {
      display: none;
    }
    button {
      margin-top: 20px;
      background-color: #231d18;
      color: #fff;
      border: none;
      padding: 14px 20px;
      border-radius: 999px;
      font-size: 15px;
      font-weight: 600;
      width: 100%;
      cursor: pointer;
      transition: transform 0.15s ease, background-color 0.2s ease-in-out;
    }
    button:hover {
      background-color: #2f2822;
      transform: translateY(-1px);
    }
    #spinner {
      display: none;
      margin-top: 20px;
    }
    .loader {
      border: 4px solid #efe5d9;
      border-top: 4px solid #231d18;
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
      font-size: 13px;
      color: #6f5f4e;
      margin-top: 22px;
      background: #f6efe5;
      border-radius: 12px;
      padding: 10px 12px;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="eyebrow">SkinPro</div>
    <h1>${safeTitle}</h1>
    <div class="subheading">${safeSubtitle}</div>
    ${errorBlock}
    ${formBlock}
    <div class="note">
      Note: Uploads happen over your private Wi-Fi network.
    </div>
  </div>
  <script>
    (function () {
      var form = document.getElementById("uploadForm");
      var button = document.getElementById("uploadButton");
      var spinner = document.getElementById("spinner");
      var libraryInput = document.getElementById("libraryInput");
      var cameraInput = document.getElementById("cameraInput");
      var previewGrid = document.getElementById("previewGrid");
      var previewUrls = [];

      function collectFiles() {
        if (libraryInput && libraryInput.files && libraryInput.files[0]) {
          return [libraryInput.files[0]];
        }
        if (cameraInput && cameraInput.files && cameraInput.files[0]) {
          return [cameraInput.files[0]];
        }
        return [];
      }

      function clearPreviews() {
        if (previewGrid) {
          previewGrid.innerHTML = "";
        }
        previewUrls.forEach(function (url) {
          URL.revokeObjectURL(url);
        });
        previewUrls = [];
      }

      function updatePreviews() {
        if (!previewGrid) {
          return;
        }
        clearPreviews();
        var files = collectFiles();
        if (!files.length) {
          previewGrid.classList.add("hidden");
          return;
        }
        previewGrid.classList.remove("hidden");
        files.forEach(function (file) {
          var url = URL.createObjectURL(file);
          previewUrls.push(url);
          var img = document.createElement("img");
          img.src = url;
          img.alt = file.name || "Selected photo";
          img.className = "previewImage";
          previewGrid.appendChild(img);
        });
      }

      window.openLibrary = function () {
        if (libraryInput) {
          libraryInput.click();
        }
      };

      window.openCamera = function () {
        if (cameraInput) {
          cameraInput.click();
        }
      };

      function resetSubmitState() {
        if (!form || form.dataset.submitting !== "true") {
          return;
        }
        if (form.dataset.navigating === "true") {
          return;
        }
        form.dataset.submitting = "";
        if (spinner) {
          spinner.style.display = "none";
        }
        if (button) {
          button.disabled = false;
          button.innerText = "Upload";
        }
      }

      if (!form) {
        window.showSpinner = function () {};
        return;
      }

      if (libraryInput) {
        libraryInput.addEventListener("change", updatePreviews);
      }
      if (cameraInput) {
        cameraInput.addEventListener("change", updatePreviews);
      }
      updatePreviews();

      window.addEventListener("beforeunload", function () {
        form.dataset.navigating = "true";
      });
      window.addEventListener("focus", resetSubmitState);
      document.addEventListener("visibilitychange", function () {
        if (document.visibilityState === "visible") {
          resetSubmitState();
        }
      });

      window.showSpinner = function () {
        if (form.dataset.submitting === "true") {
          return;
        }
        form.dataset.submitting = "true";
        if (spinner) {
          spinner.style.display = "block";
        }
        if (button) {
          button.disabled = true;
          button.innerText = "Uploading...";
        }
      };
    })();
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
      font-family: "Avenir Next", "Nunito", "Helvetica Neue", Arial, sans-serif;
      background: linear-gradient(180deg, #fbf6ee 0%, #f6efe5 100%);
      margin: 0;
      padding: 20px 0;
      display: flex;
      justify-content: center;
      align-items: flex-start;
      color: #2a241f;
    }
    .container {
      background-color: #fffdfa;
      padding: 28px 24px;
      border-radius: 18px;
      border: 1px solid #ead8c3;
      box-shadow: 0 10px 24px rgba(43, 34, 23, 0.08);
      width: 92%;
      max-width: 460px;
      text-align: center;
    }
    .eyebrow {
      text-transform: uppercase;
      letter-spacing: 0.2em;
      font-size: 11px;
      color: #7a6a58;
      margin-bottom: 10px;
    }
    h1 {
      font-size: 26px;
      margin: 0 0 6px;
      color: #241f1a;
    }
    p {
      margin: 0;
      color: #6f5f4e;
    }
    .note {
      margin-top: 16px;
      font-size: 13px;
      color: #6f5f4e;
      background: #f6efe5;
      border-radius: 12px;
      padding: 10px 12px;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="eyebrow">SkinPro</div>
    <h1>Upload Complete</h1>
    <p>${escapeHtml(args.subtitle)}</p>
    <div class="note">All set. You can close this tab.</div>
  </div>
</body>
</html>`;
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const token = url.searchParams.get("token")?.trim();
    if (!token) {
      return new NextResponse(
        renderUploadPage({
          title: "Upload Profile Picture",
          subtitle: "Missing upload token.",
          error: "Upload link is missing or invalid.",
          showForm: false
        }),
        { headers: { "Content-Type": "text/html; charset=utf-8" }, status: 400 }
      );
    }

    const tokenEntry = getUploadToken(token);
    if (!tokenEntry || tokenEntry.mode !== "profile") {
      return new NextResponse(
        renderUploadPage({
          title: "Upload Profile Picture",
          subtitle: "Upload link expired.",
          error: "Please generate a new QR code to continue.",
          showForm: false
        }),
        { headers: { "Content-Type": "text/html; charset=utf-8" }, status: 410 }
      );
    }

    const clientId = tokenEntry.clientId;

    const db = getDb();
    const client = db
      .prepare("SELECT full_name FROM clients WHERE id = ?")
      .get(clientId) as { full_name?: string } | undefined;

    if (!client?.full_name) {
      return new NextResponse(
        renderUploadPage({
          title: "Upload Profile Picture",
          subtitle: "Client not found.",
          error: "Client not found.",
          showForm: false
        }),
        { headers: { "Content-Type": "text/html; charset=utf-8" }, status: 404 }
      );
    }

    return new NextResponse(
      renderUploadPage({
        title: "Upload Profile Picture",
        subtitle: client.full_name,
        token
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
    const token = String(
      formData.get("token") ?? url.searchParams.get("token") ?? ""
    ).trim();
    if (!token) {
      return new NextResponse(
        renderUploadPage({
          title: "Upload Profile Picture",
          subtitle: "Missing upload token.",
          error: "Upload link is missing or invalid.",
          showForm: false
        }),
        { headers: { "Content-Type": "text/html; charset=utf-8" }, status: 400 }
      );
    }

    const tokenEntry = getUploadToken(token);
    if (!tokenEntry || tokenEntry.mode !== "profile") {
      return new NextResponse(
        renderUploadPage({
          title: "Upload Profile Picture",
          subtitle: "Upload link expired.",
          error: "Please generate a new QR code to continue.",
          showForm: false
        }),
        { headers: { "Content-Type": "text/html; charset=utf-8" }, status: 410 }
      );
    }

    const clientId = tokenEntry.clientId;

    const file = formData.get("photo");
    if (!(file instanceof File)) {
      return new NextResponse(
        renderUploadPage({
          title: "Upload Profile Picture",
          subtitle: "Choose a photo.",
          error: "No file selected.",
          token
        }),
        { headers: { "Content-Type": "text/html; charset=utf-8" }, status: 400 }
      );
    }

    const validation = validateImageFiles([file], PROFILE_UPLOAD_LIMITS);
    if (!validation.ok) {
      return new NextResponse(
        renderUploadPage({
          title: "Upload Profile Picture",
          subtitle: "Please adjust your selection and try again.",
          error: validation.error,
          token
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
          error: "Client not found.",
          showForm: false
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
    let rotated: Buffer;
    try {
      rotated = await normalizeImageOrientation(buffer, { strict: true });
    } catch {
      return new NextResponse(
        renderUploadPage({
          title: "Upload Profile Picture",
          subtitle: "Unable to process that image.",
          error: "Please upload a supported image file.",
          token
        }),
        { headers: { "Content-Type": "text/html; charset=utf-8" }, status: 400 }
      );
    }
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

    markUploadTokenUsed(token);

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
