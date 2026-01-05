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
  clientId: number;
  appointmentId: number;
  error?: string;
}) {
  const { title, subtitle, clientId, appointmentId, error } = args;
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
      font-size: 30px;
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
      <input type="hidden" name="appointment_id" value="${appointmentId}">
      <input type="file" name="photos" multiple accept="image/*">
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

function renderSuccessPage(args: {
  title: string;
  subtitle: string;
  uploaded: number;
}) {
  const { title, subtitle, uploaded } = args;
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
    <h1>${escapeHtml(title)}</h1>
    <p>${escapeHtml(subtitle)}</p>
    <p style="margin-top:12px;">${uploaded} photo(s) uploaded.</p>
  </div>
</body>
</html>`;
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const clientId = Number(url.searchParams.get("cid"));
    const appointmentId = Number(url.searchParams.get("aid"));

    if (!Number.isFinite(clientId) || !Number.isFinite(appointmentId)) {
      return new NextResponse(
        renderUploadPage({
          title: "Upload Photos",
          subtitle: "Missing client or appointment information.",
          clientId: clientId || 0,
          appointmentId: appointmentId || 0,
          error: "Invalid client or appointment."
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
      .get(appointmentId, clientId) as { date?: string; type?: string } | undefined;

    if (!client?.full_name || !appointment?.date) {
      return new NextResponse(
        renderUploadPage({
          title: "Upload Photos",
          subtitle: "Client or appointment not found.",
          clientId,
          appointmentId,
          error: "Client or appointment not found."
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
        clientId,
        appointmentId
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
    const appointmentId = Number(
      formData.get("appointment_id") ?? url.searchParams.get("aid")
    );

    if (!Number.isFinite(clientId) || !Number.isFinite(appointmentId)) {
      return NextResponse.json(
        { error: "client_id and appointment_id are required" },
        { status: 400 }
      );
    }

    const files = formData.getAll("photos");
    if (!files.length) {
      return new NextResponse(
        renderUploadPage({
          title: "Upload Photos",
          subtitle: "Choose one or more photos.",
          clientId,
          appointmentId,
          error: "No files selected."
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
          clientId,
          appointmentId,
          error: "Client or appointment not found."
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
    for (const entry of files) {
      if (!(entry instanceof File)) {
        continue;
      }

      const ext = guessExtension(entry.name, entry.type);
      const base = sanitizeFileName(path.basename(entry.name, ext) || "photo");
      const targetPath = uniqueFilePath(targetDir, base, ext.toLowerCase());

      const arrayBuffer = await entry.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      const rotated = await normalizeImageOrientation(buffer);
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

    if (insertedCount > 0) {
      db.prepare("UPDATE appointments SET photos_taken = 'Yes' WHERE id = ?").run(
        appointmentId
      );
    }

    return new NextResponse(
      renderSuccessPage({
        title: "Upload Complete",
        subtitle: `${client.full_name} | ${appointment.date}`,
        uploaded: insertedCount
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
