# YTLock Privacy Policy

**Last updated:** February 16, 2026

## Overview

YTLock is a browser extension that blocks YouTube channels from appearing on YouTube. Your privacy is important — YTLock is designed to work entirely on your device with zero data collection.

## Data Collection

YTLock does **not** collect, store, transmit, or share any personal data. Period.

- No analytics or tracking
- No cookies or identifiers
- No network requests to external servers
- No user behavior monitoring
- No advertising

## Data Storage

YTLock stores the following data **locally on your device** using Chrome's built-in storage API (`chrome.storage.sync`):

- Your list of blocked YouTube channels
- Your extension settings (e.g., "Block all Shorts" toggle)

This data is synced across your Chrome browsers only if you are signed into Chrome with sync enabled. This sync is handled entirely by Google Chrome — YTLock does not operate any servers.

## Permissions

YTLock requests only the permissions necessary to function:

| Permission | Why |
|---|---|
| `storage` | Save your blocked channels and settings locally. |
| `contextMenus` | Add "Block this channel" to the right-click menu. |
| `activeTab` | Identify the channel when you use the context menu. |
| Host access to `youtube.com` | Run the content script that hides blocked channels. |

## Third Parties

YTLock does not share any data with third parties. The only external resource loaded is Google Fonts for the extension's UI styling.

## Changes

If this privacy policy is updated, the changes will be reflected on this page with an updated date.

## Contact

If you have questions about this privacy policy, you can reach out via GitHub:
https://github.com/bearenbey/ytlock
