import fs from "fs";
import path from "path";
import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { loadSkinproPaths } from "@/lib/skinproPaths";
import { safeClientName } from "@/lib/clientAssets";
import { normalizeImageOrientation } from "@/lib/imageProcessing";
import { getUploadToken, markUploadTokenUsed } from "@/lib/qrTokens";
import { PHOTO_UPLOAD_LIMITS, validateImageFiles } from "@/lib/uploadValidation";
import {
  ensureDir,
  guessExtension,
  sanitizeFileName,
  uniqueFilePath
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
      <p id="pickerHint" class="pickerHint hidden">On iPhone: if prompted, choose Photo Library.</p>
      <div id="previewGrid" class="previewGrid hidden"></div>
      <input id="queueInput" class="hiddenInput" type="file" name="photos" multiple accept="image/*">
      <input id="libraryInput" class="hiddenInput" type="file" multiple accept="image/*">
      <div id="cameraInputs"></div>
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
      font-size: 28px;
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
    .pickerHint {
      margin: 10px 0 0;
      font-size: 12px;
      color: #8a7a68;
    }
    .previewGrid {
      margin-top: 14px;
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 10px;
    }
    .previewItem {
      position: relative;
    }
    .previewImage {
      width: 100%;
      aspect-ratio: 1 / 1;
      object-fit: cover;
      border-radius: 12px;
      border: 1px solid #ead8c3;
    }
    .previewRemove {
      position: absolute;
      top: -14px;
      right: 4px;
      width: 24px;
      height: 24px;
      border-radius: 999px;
      border: none;
      background: rgba(35, 29, 24, 0.9);
      color: #fff;
      font-size: 18px;
      line-height: 1;
      padding: 0;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      font-family: "Avenir Next", "Nunito", "Helvetica Neue", Arial, sans-serif;
    }
    .previewRemove span {
      display: block;
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
      var queueInput = document.getElementById("queueInput");
      var libraryInput = document.getElementById("libraryInput");
      var cameraInputs = document.getElementById("cameraInputs");
      var previewGrid = document.getElementById("previewGrid");
      var pickerHint = document.getElementById("pickerHint");
      var queuedFiles = [];
      var previewUrls = [];

      function syncQueueInput() {
        if (!queueInput) {
          return;
        }
        var dataTransfer = new DataTransfer();
        queuedFiles.forEach(function (file) {
          dataTransfer.items.add(file);
        });
        queueInput.files = dataTransfer.files;
      }

      function addFiles(files) {
        files.forEach(function (file) {
          queuedFiles.push(file);
        });
        syncQueueInput();
        updatePreviews();
      }

      function removeFileAt(index) {
        queuedFiles.splice(index, 1);
        syncQueueInput();
        updatePreviews();
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
        if (!queuedFiles.length) {
          previewGrid.classList.add("hidden");
          return;
        }
        previewGrid.classList.remove("hidden");
        queuedFiles.forEach(function (file, index) {
          var url = URL.createObjectURL(file);
          previewUrls.push(url);
          var wrapper = document.createElement("div");
          wrapper.className = "previewItem";
          var img = document.createElement("img");
          img.src = url;
          img.alt = file.name || "Selected photo";
          img.className = "previewImage";
          var removeButton = document.createElement("button");
          removeButton.type = "button";
          removeButton.className = "previewRemove";
          removeButton.innerHTML = "<span aria-hidden='true'>&times;</span>";
          removeButton.dataset.removeIndex = String(index);
          wrapper.appendChild(img);
          wrapper.appendChild(removeButton);
          previewGrid.appendChild(wrapper);
        });
      }

      window.openLibrary = function () {
        if (libraryInput) {
          libraryInput.click();
        }
      };

      window.openCamera = function () {
        if (!cameraInputs) {
          return;
        }
        var input = document.createElement("input");
        input.type = "file";
        input.accept = "image/*";
        input.capture = "environment";
        input.className = "hiddenInput";
        input.addEventListener("change", function () {
          if (!input.files || input.files.length === 0) {
            input.remove();
            return;
          }
          addFiles(Array.prototype.slice.call(input.files));
          input.remove();
        });
        cameraInputs.appendChild(input);
        input.click();
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
        libraryInput.addEventListener("change", function () {
          if (!libraryInput.files || libraryInput.files.length === 0) {
            return;
          }
          addFiles(Array.prototype.slice.call(libraryInput.files));
          libraryInput.value = "";
        });
      }
      if (previewGrid) {
        previewGrid.addEventListener("click", function (event) {
          var target = event.target;
          if (!target) {
            return;
          }
          var buttonTarget = target.closest
            ? target.closest(".previewRemove")
            : null;
          if (!buttonTarget) {
            return;
          }
          var index = Number.parseInt(buttonTarget.dataset.removeIndex, 10);
          if (Number.isFinite(index)) {
            removeFileAt(index);
          }
        });
      }
      updatePreviews();
      if (pickerHint) {
        var isIOS = /iP(ad|hone|od)/.test(navigator.userAgent);
        if (isIOS) {
          pickerHint.classList.remove("hidden");
        }
      }

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

function renderSuccessPage(args: {
  title: string;
  subtitle: string;
  uploaded: number;
  failed?: number;
}) {
  const { title, subtitle, uploaded, failed } = args;
  const failedBlock =
    failed && failed > 0
      ? `<p style="margin-top:8px;color:#a62828;">${failed} file(s) could not be processed.</p>`
      : "";
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
    .result {
      margin-top: 14px;
      font-size: 16px;
      color: #241f1a;
      font-weight: 600;
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
    <h1>${escapeHtml(title)}</h1>
    <p>${escapeHtml(subtitle)}</p>
    <div class="result">${uploaded} photo(s) uploaded.</div>
    ${failedBlock}
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
          title: "Upload Photos",
          subtitle: "Missing upload token.",
          error: "Upload link is missing or invalid.",
          showForm: false
        }),
        { headers: { "Content-Type": "text/html; charset=utf-8" }, status: 400 }
      );
    }

    const tokenEntry = getUploadToken(token);
    if (
      !tokenEntry ||
      tokenEntry.mode !== "photo" ||
      tokenEntry.appointmentId == null
    ) {
      return new NextResponse(
        renderUploadPage({
          title: "Upload Photos",
          subtitle: "Upload link expired.",
          error: "Please generate a new QR code to continue.",
          showForm: false
        }),
        { headers: { "Content-Type": "text/html; charset=utf-8" }, status: 410 }
      );
    }

    const clientId = tokenEntry.clientId;
    const appointmentId = tokenEntry.appointmentId;

    const db = getDb();
    const client = db
      .prepare("SELECT full_name FROM clients WHERE id = ?")
      .get(clientId) as { full_name?: string } | undefined;

    const appointment = db
      .prepare("SELECT date, type FROM appointments WHERE id = ? AND client_id = ?")
      .get(appointmentId, clientId) as { date?: string; type?: string } | undefined;

    if (!client?.full_name || !appointment?.date) {
      return new NextResponse(
        renderUploadPage({
          title: "Upload Photos",
          subtitle: "Client or appointment not found.",
          error: "Client or appointment not found.",
          showForm: false
        }),
        { headers: { "Content-Type": "text/html; charset=utf-8" }, status: 404 }
      );
    }

    const subtitle = [client.full_name, appointment.date, appointment.type]
      .filter(Boolean)
      .join(" | ");

    return new NextResponse(
      renderUploadPage({
        title: "Upload Photos",
        subtitle,
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
          title: "Upload Photos",
          subtitle: "Missing upload token.",
          error: "Upload link is missing or invalid.",
          showForm: false
        }),
        { headers: { "Content-Type": "text/html; charset=utf-8" }, status: 400 }
      );
    }

    const tokenEntry = getUploadToken(token);
    if (
      !tokenEntry ||
      tokenEntry.mode !== "photo" ||
      tokenEntry.appointmentId == null
    ) {
      return new NextResponse(
        renderUploadPage({
          title: "Upload Photos",
          subtitle: "Upload link expired.",
          error: "Please generate a new QR code to continue.",
          showForm: false
        }),
        { headers: { "Content-Type": "text/html; charset=utf-8" }, status: 410 }
      );
    }

    const clientId = tokenEntry.clientId;
    const appointmentId = tokenEntry.appointmentId;

    const files = formData.getAll("photos");
    const fileEntries = files.filter((entry): entry is File => entry instanceof File);
    const validation = validateImageFiles(fileEntries, PHOTO_UPLOAD_LIMITS);
    if (!validation.ok) {
      return new NextResponse(
        renderUploadPage({
          title: "Upload Photos",
          subtitle: "Please adjust your selection and try again.",
          error: validation.error,
          token
        }),
        { headers: { "Content-Type": "text/html; charset=utf-8" }, status: 400 }
      );
    }

    const db = getDb();

    const client = db
      .prepare("SELECT full_name FROM clients WHERE id = ?")
      .get(clientId) as { full_name?: string } | undefined;

    const appointment = db
      .prepare("SELECT date, type FROM appointments WHERE id = ? AND client_id = ?")
      .get(appointmentId, clientId) as
      | { date?: string; type?: string }
      | undefined;

    if (!client?.full_name || !appointment?.date) {
      return new NextResponse(
        renderUploadPage({
          title: "Upload Photos",
          subtitle: "Client or appointment not found.",
          error: "Client or appointment not found.",
          showForm: false
        }),
        { headers: { "Content-Type": "text/html; charset=utf-8" }, status: 404 }
      );
    }

    const paths = loadSkinproPaths();
    const safeName = safeClientName(client.full_name);
    const formattedDate = appointment.date.replace(/\//g, "-");
    const targetDir = path.join(
      paths.photosDir,
      `${safeName}_id_${clientId}`,
      formattedDate
    );

    ensureDir(targetDir);

    let insertedCount = 0;
    let failedCount = 0;
    for (const entry of fileEntries) {

      const ext = guessExtension(entry.name, entry.type);
      const base = sanitizeFileName(path.basename(entry.name, ext) || "photo");
      const targetPath = uniqueFilePath(targetDir, base, ext.toLowerCase());

      const arrayBuffer = await entry.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      let rotated: Buffer;
      try {
        rotated = await normalizeImageOrientation(buffer, { strict: true });
      } catch {
        failedCount += 1;
        continue;
      }
      await fs.promises.writeFile(targetPath, rotated);

      db.prepare(
        "INSERT INTO photos (client_id, appointment_id, appt_date, file_path, type, description) " +
          "VALUES (?, ?, ?, ?, ?, ?)"
      ).run(
        clientId,
        appointmentId,
        appointment.date,
        targetPath,
        appointment.type ?? null,
        ""
      );

      insertedCount += 1;
    }

    if (insertedCount === 0) {
      return new NextResponse(
        renderUploadPage({
          title: "Upload Photos",
          subtitle: "No supported files were detected.",
          error: "Please choose at least one image file.",
          token
        }),
        { headers: { "Content-Type": "text/html; charset=utf-8" }, status: 400 }
      );
    }

    if (insertedCount > 0) {
      db.prepare("UPDATE appointments SET photos_taken = 'Yes' WHERE id = ?").run(
        appointmentId
      );
    }

    markUploadTokenUsed(token);

    return new NextResponse(
      renderSuccessPage({
        title: "Upload Complete",
        subtitle: `${client.full_name} | ${appointment.date}`,
        uploaded: insertedCount,
        failed: failedCount
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
