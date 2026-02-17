// Copyright 2025 Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
import { CREDENTIAL_CONFIG } from "../config";
import { LOGGER_PREFIX } from "../constants";

let credentialRefreshTimerId = null;

// ============================================================================
// AWS Credentials — fetched from credential vending API
// ============================================================================
function setAwsCredentials(awsCredentials) {
  localStorage.setItem("awsCredentials", JSON.stringify(awsCredentials));
}

function getAwsCredentialsFromStorage() {
  const stored = localStorage.getItem("awsCredentials");
  if (!stored) return null;
  try {
    return JSON.parse(stored);
  } catch {
    return null;
  }
}

export function hasValidAwsCredentials() {
  const awsCredentials = getAwsCredentialsFromStorage();
  if (
    awsCredentials?.accessKeyId == null ||
    awsCredentials?.secretAccessKey == null ||
    awsCredentials?.sessionToken == null ||
    awsCredentials?.expiration == null
  ) {
    return false;
  }

  // 5-minute buffer before expiration
  const bufferTime = 5 * 60 * 1000;
  const currentTime = new Date();
  const expirationTime = new Date(awsCredentials.expiration);
  return currentTime.getTime() + bufferTime < expirationTime.getTime();
}

async function fetchCredentialsFromApi() {
  const apiUrl = CREDENTIAL_CONFIG.credentialVendingApiUrl;
  if (!apiUrl) {
    throw new Error("credentialVendingApiUrl is not configured in WebappConfig");
  }

  const response = await fetch(apiUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({}),
  });

  if (!response.ok) {
    throw new Error(`Credential vending API returned ${response.status}: ${response.statusText}`);
  }

  const data = await response.json();

  const credentials = {
    accessKeyId: data.accessKeyId,
    secretAccessKey: data.secretAccessKey,
    sessionToken: data.sessionToken,
    expiration: new Date(data.expiration),
  };

  console.info(`${LOGGER_PREFIX} - fetchCredentialsFromApi - Credentials obtained, expire at ${credentials.expiration.toISOString()}`);
  setAwsCredentials(credentials);
  return credentials;
}

/**
 * Get valid AWS credentials, fetching new ones if expired.
 * This is the main function called by adapters (transcribe, translate, polly).
 */
export async function getValidAwsCredentials() {
  try {
    if (hasValidAwsCredentials()) {
      return getAwsCredentialsFromStorage();
    }
    const credentials = await fetchCredentialsFromApi();
    return credentials;
  } catch (error) {
    console.error(`${LOGGER_PREFIX} - getValidAwsCredentials - Error getting AWS credentials:`, error);
    throw error;
  }
}

// ============================================================================
// Credential refresh timer — refreshes credentials before they expire
// ============================================================================
export function startCredentialRefreshTimer() {
  if (credentialRefreshTimerId) {
    clearTimeout(credentialRefreshTimerId);
  }

  const awsCredentials = getAwsCredentialsFromStorage();
  if (!awsCredentials?.expiration) {
    // No credentials yet — pre-fetch in 2 seconds
    credentialRefreshTimerId = setTimeout(async () => {
      try {
        await getValidAwsCredentials();
        startCredentialRefreshTimer();
      } catch (error) {
        console.error(`${LOGGER_PREFIX} - startCredentialRefreshTimer - Error pre-fetching credentials:`, error);
      }
    }, 2000);
    return;
  }

  const expirationTime = new Date(awsCredentials.expiration).getTime();
  const now = Date.now();
  // Refresh 5 minutes before expiration
  let refreshTime = expirationTime - now - 5 * 60 * 1000;
  if (refreshTime < 0) refreshTime = 0;

  console.info(`${LOGGER_PREFIX} - startCredentialRefreshTimer - Refresh scheduled in ${Math.floor(refreshTime / 1000)}s`);
  credentialRefreshTimerId = setTimeout(async () => {
    try {
      localStorage.removeItem("awsCredentials");
      await getValidAwsCredentials();
      startCredentialRefreshTimer();
    } catch (error) {
      console.error(`${LOGGER_PREFIX} - startCredentialRefreshTimer - Error refreshing credentials:`, error);
    }
  }, refreshTime);
}

// ============================================================================
// Logout — clears credentials and reloads
// ============================================================================
export function logout() {
  localStorage.removeItem("awsCredentials");
  if (credentialRefreshTimerId) {
    clearTimeout(credentialRefreshTimerId);
  }
  window.location.reload();
}
