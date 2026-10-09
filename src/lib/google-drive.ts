const googleDriveFilePrefix = "google-drive:";
const googleTokenUrl = "https://oauth2.googleapis.com/token";
const googleDriveApiUrl = "https://www.googleapis.com/drive/v3/files";
const googleDriveUploadUrl = "https://www.googleapis.com/upload/drive/v3/files";

let cachedAccessToken: { value: string; expiresAt: number } | null = null;

function getGoogleDriveConfig() {
  const clientId = process.env.GOOGLE_DRIVE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_DRIVE_CLIENT_SECRET;
  const refreshToken = process.env.GOOGLE_DRIVE_REFRESH_TOKEN;

  if (!clientId || !clientSecret || !refreshToken) {
    throw new Error(
      "Google Drive belum dikonfigurasi. Isi GOOGLE_DRIVE_CLIENT_ID, GOOGLE_DRIVE_CLIENT_SECRET, dan GOOGLE_DRIVE_REFRESH_TOKEN.",
    );
  }

  return { clientId, clientSecret, refreshToken };
}

async function getAccessToken() {
  if (cachedAccessToken && cachedAccessToken.expiresAt > Date.now() + 60_000) {
    return cachedAccessToken.value;
  }

  const { clientId, clientSecret, refreshToken } = getGoogleDriveConfig();
  const response = await fetch(googleTokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
    cache: "no-store",
  });
  const result = (await response.json()) as {
    access_token?: string;
    expires_in?: number;
    error_description?: string;
  };

  if (!response.ok || !result.access_token) {
    throw new Error(
      `Gagal memperoleh token Google Drive: ${result.error_description ?? response.statusText}`,
    );
  }

  cachedAccessToken = {
    value: result.access_token,
    expiresAt: Date.now() + (result.expires_in ?? 3600) * 1000,
  };
  return result.access_token;
}

async function googleDriveRequest(
  url: string,
  init?: RequestInit,
  allowNotFound = false,
) {
  const accessToken = await getAccessToken();
  const response = await fetch(url, {
    ...init,
    headers: {
      ...init?.headers,
      Authorization: `Bearer ${accessToken}`,
    },
    cache: "no-store",
  });

  if (!response.ok && !(allowNotFound && response.status === 404)) {
    const message = await response.text();
    throw new Error(
      `Google Drive gagal memproses permintaan (${response.status}): ${message}`,
    );
  }
  return response;
}

export async function uploadProfileFileToGoogleDrive(
  file: File,
  fileName: string,
) {
  const boundary = `profile-file-${crypto.randomUUID()}`;
  const metadata = JSON.stringify({ name: fileName, mimeType: file.type });
  const body = new Blob(
    [
      `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n`,
      metadata,
      `\r\n--${boundary}\r\nContent-Type: ${file.type}\r\n\r\n`,
      file,
      `\r\n--${boundary}--`,
    ],
  );

  const response = await googleDriveRequest(
    `${googleDriveUploadUrl}?uploadType=multipart&fields=id`,
    {
      method: "POST",
      headers: { "Content-Type": `multipart/related; boundary=${boundary}` },
      body,
    },
  );
  const result = (await response.json()) as { id?: string };
  if (!result.id) throw new Error("Google Drive tidak mengembalikan ID file.");
  return `${googleDriveFilePrefix}${result.id}`;
}

export function isGoogleDriveFile(storagePath: string) {
  return storagePath.startsWith(googleDriveFilePrefix);
}

function getGoogleDriveFileId(storagePath: string) {
  if (!isGoogleDriveFile(storagePath)) {
    throw new Error("Referensi file Google Drive tidak valid.");
  }
  return storagePath.slice(googleDriveFilePrefix.length);
}

export async function downloadProfileFileFromGoogleDrive(storagePath: string) {
  const fileId = getGoogleDriveFileId(storagePath);
  return googleDriveRequest(
    `${googleDriveApiUrl}/${encodeURIComponent(fileId)}?alt=media`,
  );
}

export async function deleteProfileFileFromGoogleDrive(storagePath: string) {
  const fileId = getGoogleDriveFileId(storagePath);
  await googleDriveRequest(`${googleDriveApiUrl}/${encodeURIComponent(fileId)}`, {
    method: "DELETE",
  }, true);
}
