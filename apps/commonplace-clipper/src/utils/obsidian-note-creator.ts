import browser from './browser-polyfill';
import { sanitizeFileName } from '../utils/string-utils';
import { generateFrontmatter as generateFrontmatterCore } from './shared';
import { Template, Property } from '../types/types';
import { generalSettings, incrementStat } from './storage-utils';
import { copyToClipboard } from './clipboard-utils';
import { getMessage } from './i18n';
import {
	normalizeCaptureApiBase,
	type CaptureEnvelope,
	type CaptureReceipt,
} from '@commonplace/capture-client';

export interface CommonplaceSaveSettings {
	endpointUrl: string;
	apiToken?: string;
}

export async function generateFrontmatter(properties: Property[]): Promise<string> {
	const typeMap: Record<string, string> = {};
	for (const pt of generalSettings.propertyTypes) {
		typeMap[pt.name] = pt.type;
	}
	return generateFrontmatterCore(properties, typeMap);
}

function openObsidianUrl(url: string): void {
	browser.runtime.sendMessage({
		action: "openObsidianUrl",
		url: url
	}).catch((error) => {
		console.error('Error opening Obsidian URL via background script:', error);
		window.open(url, '_blank');
	});
}

function localCaptureId(): string {
	return `local-${crypto.randomUUID()}`;
}

function titleFromClip(noteName: string, sourceUrl?: string): string {
	const trimmed = noteName.trim();
	if (trimmed) return trimmed.slice(0, 120);
	if (!sourceUrl) return 'Untitled clip';
	try {
		return new URL(sourceUrl).hostname.replace(/^www\./, '');
	} catch {
		return sourceUrl.slice(0, 120);
	}
}

function propertiesToRecord(properties: Property[]): Record<string, string> {
	return Object.fromEntries(
		properties
			.filter((property) => property.name.trim())
			.map((property) => [property.name, property.value])
	);
}

export async function saveToCommonplace(
	fileContent: string,
	noteName: string,
	properties: Property[],
	sourceUrl: string | undefined,
	settings: CommonplaceSaveSettings,
): Promise<{ ok: boolean; slug?: string }> {
	if (!settings.endpointUrl) {
		throw new Error('CommonPlace endpoint URL is not configured.');
	}

	normalizeCaptureApiBase(settings.endpointUrl);
	const payload: CaptureEnvelope = {
		client_id: localCaptureId(),
		title: titleFromClip(noteName, sourceUrl),
		body: fileContent,
		object_type: sourceUrl ? 'source' : 'note',
		captured_at: new Date().toISOString(),
		capture_method: 'clipped',
		source: 'clipper',
		...(sourceUrl ? { source_url: sourceUrl } : {}),
		properties: propertiesToRecord(properties),
	};

	const result = await browser.runtime.sendMessage({
		action: 'enqueueCommonplaceCapture',
		envelope: payload,
	}) as {
		ok?: boolean;
		queued?: boolean;
		error?: string;
		receipt?: CaptureReceipt;
	};
	if (!result?.ok) {
		throw new Error(result?.error || 'CommonPlace capture could not be queued');
	}

	return {
		ok: true,
		slug: result.receipt?.slug ?? result.receipt?.id,
	};
}

async function tryClipboardWrite(fileContent: string, obsidianUrl: string): Promise<void> {
	const success = await copyToClipboard(fileContent);

	if (success) {
		// &clipboard tells Obsidian to read data from clipboard instead of the content param.
		// content is a fallback shown only if Obsidian can't access the clipboard (e.g. on Linux).
		obsidianUrl += `&clipboard&content=${encodeURIComponent(getMessage('clipboardError', 'https://help.obsidian.md/web-clipper/troubleshoot'))}`;
		openObsidianUrl(obsidianUrl);
		console.log('Obsidian URL:', obsidianUrl);
	} else {
		console.error('All clipboard methods failed, falling back to URI method');
		// Final fallback: use URI method with actual content (same as legacy mode)
		// Note: We don't add &clipboard here since we're bypassing the clipboard entirely
		obsidianUrl += `&content=${encodeURIComponent(fileContent)}`;
		openObsidianUrl(obsidianUrl);
		console.log('Obsidian URL (URI fallback):', obsidianUrl);
	}
}

export async function saveToObsidian(
	fileContent: string,
	noteName: string,
	path: string,
	vault: string,
	behavior: Template['behavior'],
): Promise<void> {
	let obsidianUrl: string;

	const isDailyNote = behavior === 'append-daily' || behavior === 'prepend-daily';

	if (isDailyNote) {
		obsidianUrl = `obsidian://daily?`;
	} else {
		// Ensure path ends with a slash
		if (path && !path.endsWith('/')) {
			path += '/';
		}

		const formattedNoteName = sanitizeFileName(noteName);
		obsidianUrl = `obsidian://new?file=${encodeURIComponent(path + formattedNoteName)}`;
	}

	if (behavior.startsWith('append')) {
		obsidianUrl += '&append=true';
	} else if (behavior.startsWith('prepend')) {
		obsidianUrl += '&prepend=true';
	} else if (behavior === 'overwrite') {
		obsidianUrl += '&overwrite=true';
	}

	const vaultParam = vault ? `&vault=${encodeURIComponent(vault)}` : '';
	obsidianUrl += vaultParam;

	// Add silent parameter if silentOpen is enabled
	if (generalSettings.silentOpen) {
		obsidianUrl += '&silent=true';
	}

	if (generalSettings.legacyMode) {
		// Use the URI method
		obsidianUrl += `&content=${encodeURIComponent(fileContent)}`;
		console.log('Obsidian URL:', obsidianUrl);
		openObsidianUrl(obsidianUrl);
	} else {
		// Try to copy to clipboard with fallback mechanisms
		await tryClipboardWrite(fileContent, obsidianUrl);
	}
}
