// Copyright 2025 Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

export const CREDENTIAL_CONFIG = {
  credentialVendingApiUrl: getParamValue(window.WebappConfig.credentialVendingApiUrl),
  region: getParamValue(window.WebappConfig.backendRegion),
};

export const CONNECT_CONFIG = {
  connectInstanceURL: getParamValue(window.WebappConfig.connectInstanceURL),
  connectInstanceRegion: getParamValue(window.WebappConfig.connectInstanceRegion),
};

export const TRANSCRIBE_CONFIG = {
  transcribeRegion: getParamValue(window.WebappConfig.transcribeRegion),
};

export const TRANSLATE_CONFIG = {
  translateRegion: getParamValue(window.WebappConfig.translateRegion),
  translateProxyEnabled: getBoolParamValue(window.WebappConfig.translateProxyEnabled),
  translateProxyHostname: window.location.hostname,
};

export const POLLY_CONFIG = {
  pollyRegion: getParamValue(window.WebappConfig.pollyRegion),
  pollyProxyEnabled: getBoolParamValue(window.WebappConfig.pollyProxyEnabled),
  pollyProxyHostname: window.location.hostname,
};

function getParamValue(param) {
  const SSM_NOT_DEFINED = "not-defined";
  if (param === SSM_NOT_DEFINED) return undefined;
  return param;
}

function getBoolParamValue(param) {
  return param === "true";
}
