import Quill from 'quill';
import { createButton } from './utils';
import { showLightbox } from './imageGallery';
import { openGivebutterModal } from '../services/givebutter.service';

interface BlotFormat {
    new(...args: any[]): any;
    create(value: any): HTMLElement;
    sanitize?(url: string): string;
}

// Styled Image
const ImageFormat = Quill.import('formats/image') as BlotFormat;
export class StyledImage extends ImageFormat {
    static blotName = 'image';
    static tagName = 'IMG';

    static create(value: string) {
        const node = super.create(value) as HTMLImageElement;

        node.addEventListener('click', () => {
            const saveBtn = document.getElementById("save-btn");
            if (saveBtn) {
                console.log("Lightbox skipped: Image is in editor mode.");
                return;
            }
            showLightbox(node.src, node.alt);
        });

        return node;
    }

    static formats(domNode: HTMLElement) {
        return {
            style: domNode.getAttribute('style'),
            width: domNode.getAttribute('width'),
            height: domNode.getAttribute('height'),
            alt: domNode.getAttribute('alt'),
        };
    }

    format(name: string, value: string) {
        if (['style', 'width', 'height', 'alt'].includes(name)) {
            if (value) {
                this.domNode.setAttribute(name, value);
            } else {
                this.domNode.removeAttribute(name);
            }
        } else {
            super.format(name, value);
        }
    }
}

// Links
const Link = Quill.import('formats/link') as BlotFormat;

export class ActionLink extends Link {
    static blotName = 'actionLink';
    static tagName = 'A';

    static create(value: string) {
        const node = super.create(value);
        node.setAttribute('class', 'action-link');
        node.setAttribute('href', value);

        // Only open absolute external URLs in a new tab; internal paths stay _self
        if (value.startsWith('http://') || value.startsWith('https://')) {
            node.setAttribute('target', '_blank');
            node.setAttribute('rel', 'noopener noreferrer');
        } else {
            node.setAttribute('target', '_self');
        }

        return node;
    }

    static formats(node: HTMLElement) {
        return node.getAttribute('href');
    }
}

export class StandardLink extends Link {
    static create(value: string) {
        const node = super.create(value);
        const isInternal = value.startsWith('/');
        const isMailto = value.startsWith('mailto:');

        if (isInternal) {
            node.setAttribute('target', '_self');
        } else if (isMailto) {
            node.removeAttribute('target');
            node.removeAttribute('rel');
        } else {
            node.setAttribute('target', '_blank');
            node.setAttribute('rel', 'noopener noreferrer');
        }
        return node;
    }

    static formats(node: HTMLElement) {
        return node.getAttribute('href');
    }
}

// Video
const VideoFormat = Quill.import('formats/video') as BlotFormat;

export class YouTubeVideo extends VideoFormat {
    static create(value: string) {
        const node = super.create(value);
        const url = this.sanitize ? this.sanitize(value) : value;
        node.setAttribute('src', url);
        node.setAttribute('frameborder', '0');
        node.setAttribute('allowfullscreen', 'true');
        node.setAttribute('style', 'width: 100%; aspect-ratio: 16/9;');
        return node;
    }

    static sanitize(url: string) {
        const youtubeMatch = url.match(/^(?:https?:\/\/)?(?:www\.)?(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))([\w-]{11})(?:\S+)?$/);
        if (youtubeMatch) {
            return `https://www.youtube.com/embed/${youtubeMatch[1]}`;
        }
        return url;
    }
}

// Givebutter Embed
// Givebutter Embed
const BlockEmbed = Quill.import('blots/block/embed') as any;

export class GivebutterWidgetBlot extends BlockEmbed {
    static blotName = 'givebutter';
    static tagName = 'BUTTON';

    static create(value: string) {
        const widgetId = value && value.trim() !== "" ? value.trim() : 'gRGya8';
        const node = createButton({ 
            buttonText: "Donate Now", 
            buttonType: "button", 
            buttonId: "", 
            buttonClass: "action-link donate-button", 
            icon: "favorite", 
            i18n: "donate_now" 
        });
        node.setAttribute('data-id', widgetId);

        // Check if we are currently inside the editor view or a read-only viewer
        const isEditing = document.getElementById('editor-container') !== null;

        if (isEditing) {
            // Show the form ID badge only when editing/authoring
            const idTag = document.createElement('span');
            idTag.setAttribute('class', 'donate-id-tag');
            idTag.style.cssText = "margin-left: 6px; opacity: 0.7; font-size: 0.85em;";
            idTag.innerText = `(${widgetId})`;
            node.appendChild(idTag);
        } else {
            // Attach click handler for public visitors viewing published pages/posts
            node.addEventListener('click', async (e) => {
                e.preventDefault();
                e.stopPropagation();
                
                try {
                    console.log("Opening donate form for ID:", widgetId);
                    openGivebutterModal(widgetId);
                } catch (err) {
                    console.error("Failed to open donation form:", err);
                }
            });
        }

        return node;
    }

    static value(node: HTMLElement) {
        return node.getAttribute('data-id');
    }
}

// Function to register custom blots globally across Quill instances
export function registerCustomQuillBlots() {
    Quill.register(GivebutterWidgetBlot, true);
    Quill.register('formats/video', YouTubeVideo, true);
    Quill.register('formats/actionLink', ActionLink, true);
    Quill.register('formats/link', StandardLink, true);
    Quill.register('formats/image', StyledImage, true);
}