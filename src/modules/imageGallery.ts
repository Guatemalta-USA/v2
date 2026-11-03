import { ImageMetadata } from "../models/helper.model.js";
import { makeElement } from "./utils.js";

export async function getPhotosFromGithub(baseURL: string): Promise<ImageMetadata[]> {
  try {
    const response = await fetch(`${baseURL}/imageData.json`);
    const imageData: ImageMetadata[] = await response.json();
    return imageData.reduce((acc: ImageMetadata[], image: ImageMetadata) => {
      const nextImage = new ImageMetadata(`${baseURL}/${image.filename}`, image.altText);
      acc.push(nextImage);
      return acc;
    }, [])
  } catch (error) {
    console.error('Error fetching JSON:', error);
    return [];
  }
}

export function showLightbox(url: string, alt: string) {
  const overlay = document.createElement('div');
  overlay.className = 'lightbox-overlay';
  const img = document.createElement('img') as HTMLImageElement;
  img.src = url;
  img.alt = alt
  img.className = 'lightbox-image';
  const hint = document.createElement('span');
  hint.textContent = '(Click anywhere to close)';
  hint.className = 'lightbox-hint';
  const caption = makeElement("span", null, "image-caption", alt);
  overlay.append(img, caption, hint);

  const gallery = document.getElementById("gallery-container");
  if (gallery) {
    gallery.style.animationPlayState = 'paused';
  }

  
  document.body.appendChild(overlay);
  overlay.onclick = () => {
    overlay.classList.add('fadeOut');
    setTimeout(() => overlay.remove(), 200);
    if (gallery) {
      gallery.style.animationPlayState = 'running';
    }
  };

  const handleEsc = (event: KeyboardEvent) => {
    if (event.key === "Escape") {
      overlay.classList.add('fadeOut');
      setTimeout(() => overlay.remove(), 200);
      if (gallery) {
        gallery.style.animationPlayState = 'running';
      }

    }
  };
  window.addEventListener("keydown", handleEsc);
}

export function displayGallery(imageData: ImageMetadata[]) {
    const imageContainer = makeElement("div", "gallery-container", null, null);
    const imageGroup1 = imageData.reduce((acc: HTMLElement, currImg: ImageMetadata) => {
        const nextImage = document.createElement("img") as HTMLImageElement;
        nextImage.src = currImg.filename;
        nextImage.alt = currImg.altText;
        nextImage.addEventListener("click", () => showLightbox(currImg.filename, currImg.altText));
        acc.appendChild(nextImage);
        return acc;
    }, makeElement("div", null, "image-group", null));
    imageContainer.appendChild(imageGroup1);
    const imageGroup2 = imageData.reduce((acc: HTMLElement, currImg: ImageMetadata) => {
        const nextImage = document.createElement("img") as HTMLImageElement;
        nextImage.src = currImg.filename;
        nextImage.alt = currImg.altText;
        nextImage.addEventListener("click", () => showLightbox(currImg.filename, currImg.altText));
        acc.appendChild(nextImage);
        return acc;
    }, makeElement("div", null, "image-group", null));
    imageContainer.appendChild(imageGroup2);
    return imageContainer;
}

export const setupControls = () => {
  const container = document.querySelector<HTMLDivElement>('#gallery-container');
  const toggleBtn = document.querySelector<HTMLButtonElement>('#gallery-toggle');
  const spanText = toggleBtn?.querySelector<HTMLButtonElement>("span");

  if (!container || !toggleBtn) return;

  toggleBtn.addEventListener('click', () => {
    const isPaused = container.style.animationPlayState === 'paused';

    if (isPaused) {
      container.style.animationPlayState = 'running';
      if (spanText) spanText.textContent = 'pause';
    } else {
      container.style.animationPlayState = 'paused';
      if(spanText) spanText.textContent = 'play_arrow';
    }
  });
};

